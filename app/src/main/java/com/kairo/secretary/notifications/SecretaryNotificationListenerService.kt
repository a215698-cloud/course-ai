package com.kairo.secretary.notifications

import android.app.Notification
import android.app.Person
import android.os.Build
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.os.BundleCompat
import com.kairo.secretary.data.ApiClassifiedException
import com.kairo.secretary.data.ConnectionErrorType
import com.kairo.secretary.data.IngestRequest
import com.kairo.secretary.data.ListenerDiagnostic
import com.kairo.secretary.data.PendingSyncItem
import com.kairo.secretary.data.PiiRedactor
import com.kairo.secretary.data.PrefsStore
import com.kairo.secretary.data.SecretaryApiClient
import com.kairo.secretary.data.SyncEventBus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * Authorized Android NotificationListenerService for WeChat and WhatsApp.
 * Enforces user privacy rules (source toggles, blocked senders, on-device PII redaction),
 * persistent deduplication, and offline retry queueing before calling the server-side Gemini proxy.
 */
class SecretaryNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefsStore: PrefsStore
    private lateinit var apiClient: SecretaryApiClient

    companion object {
        const val WECHAT_PACKAGE = "com.tencent.mm"
        const val WHATSAPP_PACKAGE = "com.whatsapp"
        const val WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b"
        private val AUTHORIZED_PACKAGES = setOf(WECHAT_PACKAGE, WHATSAPP_PACKAGE, WHATSAPP_BUSINESS_PACKAGE)
        private val MYT_ZONE = ZoneId.of("Asia/Kuala_Lumpur")
        private val TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'MYT'")
    }

    override fun onCreate() {
        super.onCreate()
        prefsStore = PrefsStore(applicationContext)
        apiClient = SecretaryApiClient(prefsStore)
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        val nowStr = nowMytFormatted()
        prefsStore.setListenerServiceBound(true, nowStr)
        if (prefsStore.getPendingSyncQueue().isNotEmpty()) {
            PendingMessageSyncWorker.schedule(applicationContext, immediate = true)
        }
        SyncEventBus.notifySynced()
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        prefsStore.setListenerServiceBound(false, nowMytFormatted())
        SyncEventBus.notifySynced()
    }

    private fun nowMytFormatted(): String =
        Instant.now().atZone(MYT_ZONE).format(TIME_FMT)

    private fun recordDiagnostic(
        source: String,
        sender: String,
        status: String,
        detail: String,
        syncedSuccess: Boolean = false
    ) {
        val nowStr = nowMytFormatted()
        prefsStore.saveListenerDiagnostic(
            ListenerDiagnostic(
                timestampMYT = nowStr,
                source = source,
                sender = sender,
                status = status,
                detail = detail.take(180)
            )
        )
        prefsStore.recordChannelEvent(
            source = source,
            timestampMYT = nowStr,
            sender = sender,
            status = status,
            detail = detail,
            syncedSuccess = syncedSuccess
        )
        if (syncedSuccess) {
            prefsStore.setLastSyncTimeMYT(nowStr)
        }
        SyncEventBus.notifySynced()
    }

    private fun computeDedupeKey(source: String, sender: String, body: String, postTimeMs: Long): String {
        val bucket = (if (postTimeMs > 0L) postTimeMs else System.currentTimeMillis()) / 15_000L
        val raw = "$source|${sender.trim().lowercase()}|${body.trim()}|$bucket"
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun extractSenderAndBody(extras: Bundle): Pair<String, String> {
        var sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        var body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()

        @Suppress("DEPRECATION")
        val messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        if (!messages.isNullOrEmpty()) {
            val lastBundle = messages.lastOrNull() as? Bundle
            if (lastBundle != null) {
                val msgText = lastBundle.getCharSequence("text")?.toString()?.trim()
                if (!msgText.isNullOrBlank()) {
                    body = msgText
                }
                val msgSender = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val person = BundleCompat.getParcelable(lastBundle, "sender_person", Person::class.java)
                    person?.name?.toString()?.trim()
                        ?: lastBundle.getCharSequence("sender")?.toString()?.trim()
                } else {
                    lastBundle.getCharSequence("sender")?.toString()?.trim()
                }
                if (!msgSender.isNullOrBlank()) {
                    sender = msgSender
                }
            }
        }

        return sender to body
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val packageName = sbn?.packageName ?: return
        if (packageName !in AUTHORIZED_PACKAGES) return

        val notification = sbn.notification ?: return
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

        val sourceApp = when (packageName) {
            WECHAT_PACKAGE -> "wechat"
            WHATSAPP_PACKAGE, WHATSAPP_BUSINESS_PACKAGE -> "whatsapp"
            else -> return
        }

        if (!prefsStore.isSourceLocallyEnabled(sourceApp)) {
            recordDiagnostic(sourceApp, "-", "Paused", "Source is disabled in Privacy Controls")
            return
        }

        val extras = notification.extras ?: return
        val (sender, body) = extractSenderAndBody(extras)

        if (sender.isBlank() || body.isBlank()) return
        if (prefsStore.isSenderLocallyBlocked(sender)) {
            recordDiagnostic(sourceApp, sender, "Blocked", "Sender is on Privacy Blocklist")
            return
        }

        val dedupeKey = computeDedupeKey(sourceApp, sender, body, sbn.postTime)
        if (prefsStore.isDuplicateOrInQueue(dedupeKey)) {
            return
        }

        val chatTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()?.trim()
        val safeText = if (prefsStore.isLocalRedactEnabled()) PiiRedactor.redact(body) else body
        val postMillis = if (sbn.postTime > 0L) sbn.postTime else System.currentTimeMillis()
        val receivedMyt = Instant.ofEpochMilli(postMillis)
            .atZone(MYT_ZONE)
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

        val payload = IngestRequest(
            source = sourceApp,
            sender = sender,
            chatTitle = chatTitle,
            rawText = safeText,
            receivedAt = receivedMyt,
            uiLanguage = prefsStore.getLanguage()
        )

        val queueItem = PendingSyncItem(
            id = UUID.randomUUID().toString(),
            dedupeKey = dedupeKey,
            request = payload,
            queuedAtMYT = nowMytFormatted()
        )

        if (!prefsStore.enqueuePendingSync(queueItem)) return

        if (prefsStore.getBackendUrl().isBlank()) {
            recordDiagnostic(sourceApp, sender, "Queued", "Backend URL not configured yet (queued locally)")
            return
        }
        if (prefsStore.getAuthToken().isNullOrBlank()) {
            recordDiagnostic(sourceApp, sender, "Auth Required", "Queued locally; open Kairo to unlock passcode")
            return
        }

        serviceScope.launch {
            var attemptResult = runCatching { apiClient.ingestMessage(payload) }
            if (attemptResult.isFailure) {
                val err = attemptResult.exceptionOrNull()
                val errType = (err as? ApiClassifiedException)?.errorType
                if (errType != ConnectionErrorType.AUTH_FAILED) {
                    delay(1_200L)
                    attemptResult = runCatching { apiClient.ingestMessage(payload) }
                }
            }

            attemptResult.onSuccess { response ->
                prefsStore.markDedupeSynced(dedupeKey)
                prefsStore.removePendingSync(queueItem.id)
                response.state?.let { prefsStore.saveCachedState(it) }
                recordDiagnostic(
                    source = sourceApp,
                    sender = sender,
                    status = "Synced",
                    detail = "Analyzed & saved to workspace",
                    syncedSuccess = true
                )

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
                        title = "${msg.sender} (${sourceApp.replaceFirstChar { it.uppercase() }})",
                        body = msg.summary
                    )
                }
            }.onFailure { err ->
                val classified = err as? ApiClassifiedException
                val statusLabel = when (classified?.errorType) {
                    ConnectionErrorType.AUTH_FAILED -> "Auth Required"
                    ConnectionErrorType.AI_SERVICE_ERROR -> "AI Busy (Queued)"
                    else -> "Queued Retry"
                }
                prefsStore.markPendingRetryFailure(queueItem.id, err.message ?: "Upload failed")
                recordDiagnostic(
                    source = sourceApp,
                    sender = sender,
                    status = statusLabel,
                    detail = err.message ?: "Queued for automatic retry when online",
                    syncedSuccess = false
                )
                if (classified?.errorType != ConnectionErrorType.AUTH_FAILED) {
                    PendingMessageSyncWorker.schedule(applicationContext)
                }
            }
        }
    }
}
