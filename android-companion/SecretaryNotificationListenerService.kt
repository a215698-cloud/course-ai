package com.kairo.secretary.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/**
 * Kotlin NotificationListenerService reference prepared to connect directly
 * to this project's POST /api/messages/ingest endpoint.
 *
 * Authorized packages supported:
 * - com.tencent.mm (WeChat)
 * - com.whatsapp (WhatsApp)
 */
class SecretaryNotificationListenerService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private const val WECHAT_PACKAGE = "com.tencent.mm"
        private const val WHATSAPP_PACKAGE = "com.whatsapp"
        private val AUTHORIZED_PACKAGES = setOf(WECHAT_PACKAGE, WHATSAPP_PACKAGE)

        // Configure your deployed backend URL in BuildConfig or encrypted preferences
        private const val INGEST_ENDPOINT = "https://YOUR_DEPLOYED_APP_URL/api/messages/ingest"
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val packageName = sbn?.packageName ?: return
        if (packageName !in AUTHORIZED_PACKAGES) return

        val notification = sbn.notification ?: return
        // Ignore ongoing/group summary notifications to avoid duplicate processing
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

        val extras = notification.extras ?: return
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()

        if (sender.isBlank() || body.isBlank()) return

        val sourceApp = when (packageName) {
            WECHAT_PACKAGE -> "wechat"
            WHATSAPP_PACKAGE -> "whatsapp"
            else -> return
        }

        val payload = NotificationIngestPayload(
            source = sourceApp,
            sender = sender,
            chatTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString(),
            rawText = body,
            receivedAt = Instant.ofEpochMilli(sbn.postTime).toString(),
            androidPackageName = packageName
        )

        scope.launch {
            postToSecretaryBackend(payload)
        }
    }

    private fun postToSecretaryBackend(payload: NotificationIngestPayload) {
        val url = URL(INGEST_ENDPOINT)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            doOutput = true
            connectTimeout = 10_000
            readTimeout = 15_000
        }
        try {
            conn.outputStream.use { os ->
                os.write(json.encodeToString(payload).toByteArray(Charsets.UTF_8))
            }
            conn.responseCode // Trigger request execution
        } finally {
            conn.disconnect()
        }
    }
}

@Serializable
data class NotificationIngestPayload(
    val source: String,
    val sender: String,
    val chatTitle: String? = null,
    val rawText: String,
    val receivedAt: String,
    val androidPackageName: String
)
