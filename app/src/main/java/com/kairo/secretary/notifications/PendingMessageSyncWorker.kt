package com.kairo.secretary.notifications

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ListenableWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.kairo.secretary.data.ApiClassifiedException
import com.kairo.secretary.data.ConnectionErrorType
import com.kairo.secretary.data.ListenerDiagnostic
import com.kairo.secretary.data.PrefsStore
import com.kairo.secretary.data.SecretaryApiClient
import com.kairo.secretary.data.SyncEventBus
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker that drains queued WeChat/WhatsApp notifications once connectivity returns,
 * enforcing exponential backoff, deduplication, and auth safety.
 */
class PendingMessageSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val UNIQUE_WORK_NAME = "kairo_pending_message_sync"
        private const val MAX_RETRY_PER_ITEM = 8
        private val MYT_ZONE = ZoneId.of("Asia/Kuala_Lumpur")
        private val TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'MYT'")

        fun schedule(context: Context, immediate: Boolean = false) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val builder = OneTimeWorkRequestBuilder<PendingMessageSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)

            if (!immediate) {
                builder.setInitialDelay(3, TimeUnit.SECONDS)
            }

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                builder.build()
            )
        }
    }

    override suspend fun doWork(): ListenableWorker.Result {
        val prefs = PrefsStore(applicationContext)
        val queue = prefs.getPendingSyncQueue()
        if (queue.isEmpty()) return ListenableWorker.Result.success()

        if (prefs.getBackendUrl().isBlank() || prefs.getAuthToken().isNullOrBlank()) {
            return ListenableWorker.Result.success()
        }

        val apiClient = SecretaryApiClient(prefs)
        var shouldRetryLater = false

        for (item in queue) {
            if (item.retryCount >= MAX_RETRY_PER_ITEM) {
                prefs.removePendingSync(item.id)
                continue
            }

            val attempt = runCatching { apiClient.ingestMessage(item.request) }
            if (attempt.isSuccess) {
                val response = attempt.getOrThrow()
                val nowStr = Instant.now().atZone(MYT_ZONE).format(TIME_FMT)
                prefs.markDedupeSynced(item.dedupeKey)
                prefs.removePendingSync(item.id)
                prefs.setLastSyncTimeMYT(nowStr)
                response.state?.let { prefs.saveCachedState(it) }

                prefs.recordChannelEvent(
                    source = item.request.source,
                    timestampMYT = nowStr,
                    sender = item.request.sender,
                    status = "Synced",
                    detail = "Retry sync succeeded",
                    syncedSuccess = true
                )
                prefs.saveListenerDiagnostic(
                    ListenerDiagnostic(
                        timestampMYT = nowStr,
                        source = item.request.source,
                        sender = item.request.sender,
                        status = "Synced",
                        detail = "Queued message synced after reconnect"
                    )
                )
                SyncEventBus.notifySynced()

                val msg = response.message
                if (response.detectedChanges.isNotEmpty()) {
                    val chg = response.detectedChanges.first()
                    DeadlineNotifier.postAlert(
                        context = applicationContext,
                        id = (chg.id.hashCode() and 0x7fffffff),
                        title = "Schedule Change: ${chg.title}",
                        body = chg.summary
                    )
                } else if (msg != null && (msg.importance == "critical" || msg.importance == "high")) {
                    DeadlineNotifier.postAlert(
                        context = applicationContext,
                        id = (msg.id.hashCode() and 0x7fffffff),
                        title = "${msg.sender} (${item.request.source.replaceFirstChar { it.uppercase() }})",
                        body = msg.summary
                    )
                }
            } else {
                val err = attempt.exceptionOrNull()
                val classified = err as? ApiClassifiedException
                val nowStr = Instant.now().atZone(MYT_ZONE).format(TIME_FMT)
                if (classified?.errorType == ConnectionErrorType.AUTH_FAILED) {
                    prefs.saveListenerDiagnostic(
                        ListenerDiagnostic(
                            timestampMYT = nowStr,
                            source = item.request.source,
                            sender = item.request.sender,
                            status = "Auth Required",
                            detail = err.message ?: "Passcode unlock required"
                        )
                    )
                    SyncEventBus.notifySynced()
                    return ListenableWorker.Result.success()
                }
                prefs.markPendingRetryFailure(item.id, err?.message ?: "Retry failed")
                prefs.recordChannelEvent(
                    source = item.request.source,
                    timestampMYT = nowStr,
                    sender = item.request.sender,
                    status = "Retrying",
                    detail = err?.message ?: "Waiting for network/server",
                    syncedSuccess = false
                )
                shouldRetryLater = true
            }
        }

        return if (shouldRetryLater) ListenableWorker.Result.retry() else ListenableWorker.Result.success()
    }
}
