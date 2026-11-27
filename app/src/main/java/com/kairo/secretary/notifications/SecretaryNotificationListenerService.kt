package com.kairo.secretary.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.kairo.secretary.data.IngestRequest
import com.kairo.secretary.data.PiiRedactor
import com.kairo.secretary.data.PrefsStore
import com.kairo.secretary.data.SecretaryApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * Authorized Android NotificationListenerService for WeChat and WhatsApp.
 * Enforces user privacy rules (source toggles, blocked senders, on-device PII redaction)
 * before forwarding to the server-side Gemini proxy. No API keys live on the device.
 */
class SecretaryNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefsStore: PrefsStore
    private lateinit var apiClient: SecretaryApiClient

    private var lastSignature: String = ""
    private var lastPostTimeMs: Long = 0L

    companion object {
        private const val WECHAT_PACKAGE = "com.tencent.mm"
        private const val WHATSAPP_PACKAGE = "com.whatsapp"
        private val AUTHORIZED_PACKAGES = setOf(WECHAT_PACKAGE, WHATSAPP_PACKAGE)
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

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val packageName = sbn?.packageName ?: return
        if (packageName !in AUTHORIZED_PACKAGES) return

        val notification = sbn.notification ?: return
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

        val sourceApp = when (packageName) {
            WECHAT_PACKAGE -> "wechat"
            WHATSAPP_PACKAGE -> "whatsapp"
            else -> return
        }

        if (!prefsStore.isSourceLocallyEnabled(sourceApp)) return

        val extras = notification.extras ?: return
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()

        if (sender.isBlank() || body.isBlank()) return
        if (prefsStore.isSenderLocallyBlocked(sender)) return

        // Avoid duplicate notifications fired within 3 seconds
        val signature = "$packageName|$sender|$body"
        val nowMs = System.currentTimeMillis()
        if (signature == lastSignature && (nowMs - lastPostTimeMs) < 3_000L) return
        lastSignature = signature
        lastPostTimeMs = nowMs

        val chatTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()?.trim()
        val safeText = if (prefsStore.isLocalRedactEnabled()) PiiRedactor.redact(body) else body

        val payload = IngestRequest(
            source = sourceApp,
            sender = sender,
            chatTitle = chatTitle,
            rawText = safeText,
            receivedAt = Instant.ofEpochMilli(sbn.postTime).toString(),
            uiLanguage = prefsStore.getLanguage()
        )

        serviceScope.launch {
            runCatching {
                val response = apiClient.ingestMessage(payload)
                response.state?.let { prefsStore.saveCachedState(it) }

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
            }
        }
    }
}
