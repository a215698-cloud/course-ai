package com.kairo.secretary.data

import android.content.Context
import com.kairo.secretary.BuildConfig
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object SyncEventBus {
    private val _events = MutableSharedFlow<Unit>(extraBufferCapacity = 16)
    val events = _events.asSharedFlow()

    fun notifySynced() {
        _events.tryEmit(Unit)
    }
}

class PrefsStore(context: Context) {
    private val prefs = context.getSharedPreferences("kairo_secretary_prefs", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private val queueLock = Any()

        private const val KEY_BACKEND_URL = "backend_url"
        private const val KEY_RECENT_URLS = "recent_backend_urls_json"
        private const val KEY_AUTH_TOKEN = "auth_bearer_token"
        private const val KEY_LANGUAGE = "ui_language"
        private const val KEY_CACHED_STATE = "cached_state_json"
        private const val KEY_LISTENER_DIAG = "listener_last_diagnostic"
        private const val KEY_CHANNEL_STATS = "listener_channel_stats_json"
        private const val KEY_LISTENER_BOUND = "listener_service_bound"
        private const val KEY_LISTENER_BOUND_TIME = "listener_bound_time_myt"
        private const val KEY_LAST_SYNC_MYT = "last_successful_sync_myt"
        private const val KEY_KEEP_ALIVE = "foreground_keep_alive_enabled"
        private const val KEY_PENDING_QUEUE = "pending_sync_queue_json"
        private const val KEY_DEDUPE_ENTRIES = "recent_dedupe_entries_json"

        private const val KEY_REDACT_LOCAL = "local_redact"
        private const val KEY_WECHAT_ENABLED = "local_wechat_enabled"
        private const val KEY_WHATSAPP_ENABLED = "local_whatsapp_enabled"
        private const val KEY_BLOCKED_SENDERS = "local_blocked_senders"

        private const val MAX_QUEUE_SIZE = 50
        private const val DEDUPE_TTL_MS = 10 * 60 * 1000L
        private const val MAX_DEDUPE_ENTRIES = 120
    }

    private fun isAiStudioPreviewHost(host: String): Boolean {
        val lower = host.lowercase()
        return lower.startsWith("ais-dev-") || lower.startsWith("ais-pre-")
    }

    private fun putEncryptedString(key: String, plainValue: String) {
        prefs.edit().putString(key, SecureStorage.encrypt(plainValue)).apply()
    }

    private fun getDecryptedString(key: String): String? {
        val raw = prefs.getString(key, null) ?: return null
        val decrypted = SecureStorage.decrypt(raw)
        if (decrypted != null && !raw.startsWith("enc:v1:")) {
            // Migrate legacy plaintext value to Keystore AES-GCM at rest
            prefs.edit().putString(key, SecureStorage.encrypt(decrypted)).apply()
        }
        return decrypted
    }

    fun getBackendUrl(): String {
        val saved = prefs.getString(KEY_BACKEND_URL, null)?.trim()
        if (!saved.isNullOrBlank()) {
            val parsed = saved.toHttpUrlOrNull()
            if (parsed != null && isAiStudioPreviewHost(parsed.host)) {
                // Purge legacy broken ais-dev / ais-pre URLs persisted by older APK builds
                prefs.edit().remove(KEY_BACKEND_URL).remove(KEY_AUTH_TOKEN).apply()
            } else {
                return saved.trimEnd('/')
            }
        }
        val builtIn = BuildConfig.DEFAULT_BACKEND_URL.trim().trimEnd('/')
        val builtInParsed = builtIn.toHttpUrlOrNull()
        return if (builtInParsed != null && isAiStudioPreviewHost(builtInParsed.host)) "" else builtIn
    }

    fun getRecentBackendUrls(): List<String> {
        val raw = prefs.getString(KEY_RECENT_URLS, null)
        val stored = if (!raw.isNullOrBlank()) {
            runCatching { json.decodeFromString<List<String>>(raw) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
        val builtInDefault = BuildConfig.DEFAULT_BACKEND_URL.trim().trimEnd('/')
        return (stored + listOfNotNull(builtInDefault.takeIf { it.isNotBlank() }))
            .map { it.trim().trimEnd('/') }
            .filter { url ->
                val host = url.toHttpUrlOrNull()?.host.orEmpty()
                url.isNotBlank() && !isAiStudioPreviewHost(host)
            }
            .distinct()
            .take(4)
    }

    private fun recordRecentUrl(cleanUrl: String) {
        val updated = (listOf(cleanUrl) + getRecentBackendUrls())
            .distinct()
            .take(4)
        runCatching {
            prefs.edit().putString(KEY_RECENT_URLS, json.encodeToString(updated)).apply()
        }
    }

    fun normalizeBackendUrl(rawUrl: String): Result<String> {
        val trimmed = rawUrl.trim()
        if (trimmed.isBlank()) {
            return Result.failure(IllegalArgumentException("Backend URL cannot be empty."))
        }

        val withScheme = when {
            trimmed.startsWith("https://", ignoreCase = true) ->
                "https://" + trimmed.substring(8)
            trimmed.startsWith("http://", ignoreCase = true) ->
                "http://" + trimmed.substring(7)
            trimmed.startsWith("localhost", ignoreCase = true) ||
                trimmed.startsWith("127.0.0.1") ||
                trimmed.startsWith("10.0.2.2") ->
                "http://$trimmed"
            else ->
                "https://$trimmed"
        }

        val parsed = withScheme.toHttpUrlOrNull()
            ?: return Result.failure(IllegalArgumentException("Invalid URL format. Example: https://your-service.a.run.app"))

        if (isAiStudioPreviewHost(parsed.host)) {
            return Result.failure(
                IllegalArgumentException(
                    "AI Studio preview URLs (ais-dev / ais-pre) cannot be accessed from mobile apps (302/404). " +
                        "Click Deploy app -> Google Cloud Run in AI Studio and paste the deployed https://...run.app URL."
                )
            )
        }

        val localHosts = setOf("10.0.2.2", "127.0.0.1", "localhost")
        if (parsed.scheme == "http" && parsed.host.lowercase() !in localHosts) {
            return Result.failure(
                IllegalArgumentException(
                    "Android blocks unencrypted http:// for remote servers. Use https:// (or http:// only for 10.0.2.2 / localhost)."
                )
            )
        }

        val portSuffix = if (
            (parsed.scheme == "https" && parsed.port != 443) ||
            (parsed.scheme == "http" && parsed.port != 80)
        ) {
            ":${parsed.port}"
        } else {
            ""
        }

        // Normalize strictly to scheme://host[:port] so browser sub-paths (/overview, /api/...) never break /api/* calls
        val clean = "${parsed.scheme}://${parsed.host}$portSuffix"
        return Result.success(clean)
    }

    fun saveBackendUrl(rawUrl: String): Result<String> {
        val normalized = normalizeBackendUrl(rawUrl)
        normalized.onSuccess { clean ->
            val previous = getBackendUrl()
            val editor = prefs.edit().putString(KEY_BACKEND_URL, clean)
            if (previous != clean) {
                editor.remove(KEY_AUTH_TOKEN)
            }
            editor.apply()
            recordRecentUrl(clean)
        }
        return normalized
    }

    fun getAuthToken(): String? {
        return getDecryptedString(KEY_AUTH_TOKEN)?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun setAuthToken(token: String) {
        putEncryptedString(KEY_AUTH_TOKEN, token.trim())
    }

    fun clearAuthToken() {
        prefs.edit().remove(KEY_AUTH_TOKEN).apply()
    }

    fun getLanguage(): String {
        return prefs.getString(KEY_LANGUAGE, "en") ?: "en"
    }

    fun setLanguage(lang: String) {
        prefs.edit().putString(KEY_LANGUAGE, lang).apply()
    }

    fun isKeepAliveEnabled(): Boolean = prefs.getBoolean(KEY_KEEP_ALIVE, false)

    fun setKeepAliveEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_KEEP_ALIVE, enabled).apply()
    }

    fun setListenerServiceBound(bound: Boolean, timestampMYT: String? = null) {
        val editor = prefs.edit().putBoolean(KEY_LISTENER_BOUND, bound)
        if (!timestampMYT.isNullOrBlank()) {
            editor.putString(KEY_LISTENER_BOUND_TIME, timestampMYT)
        }
        editor.apply()
    }

    fun isListenerServiceBound(): Boolean = prefs.getBoolean(KEY_LISTENER_BOUND, false)

    fun getLastListenerBoundTimeMYT(): String? =
        prefs.getString(KEY_LISTENER_BOUND_TIME, null)?.takeIf { it.isNotBlank() }

    fun setLastSyncTimeMYT(timestampMYT: String) {
        prefs.edit().putString(KEY_LAST_SYNC_MYT, timestampMYT).apply()
    }

    fun getLastSyncTimeMYT(): String? =
        prefs.getString(KEY_LAST_SYNC_MYT, null)?.takeIf { it.isNotBlank() }

    fun getCachedState(): SecretaryState? {
        val raw = getDecryptedString(KEY_CACHED_STATE) ?: return null
        return runCatching { json.decodeFromString<SecretaryState>(raw) }.getOrNull()
    }

    fun saveCachedState(state: SecretaryState) {
        runCatching {
            val encoded = json.encodeToString(state)
            prefs.edit()
                .putString(KEY_CACHED_STATE, SecureStorage.encrypt(encoded))
                .putBoolean(KEY_REDACT_LOCAL, state.privacy.redactSensitiveInfo)
                .putBoolean(KEY_WECHAT_ENABLED, state.privacy.enabledSources["wechat"] ?: true)
                .putBoolean(KEY_WHATSAPP_ENABLED, state.privacy.enabledSources["whatsapp"] ?: true)
                .putStringSet(KEY_BLOCKED_SENDERS, state.privacy.blockedSenders.map { it.lowercase() }.toSet())
                .apply()
        }
    }

    fun saveListenerDiagnostic(diag: ListenerDiagnostic) {
        synchronized(queueLock) {
            runCatching {
                putEncryptedString(KEY_LISTENER_DIAG, json.encodeToString(diag))
            }
        }
    }

    fun getListenerDiagnostic(): ListenerDiagnostic? {
        val raw = getDecryptedString(KEY_LISTENER_DIAG) ?: return null
        return runCatching { json.decodeFromString<ListenerDiagnostic>(raw) }.getOrNull()
    }

    fun getAllChannelStats(): Map<String, ChannelStats> {
        val raw = getDecryptedString(KEY_CHANNEL_STATS) ?: return emptyMap()
        return runCatching { json.decodeFromString<Map<String, ChannelStats>>(raw) }.getOrDefault(emptyMap())
    }

    fun recordChannelEvent(
        source: String,
        timestampMYT: String,
        sender: String,
        status: String,
        detail: String,
        syncedSuccess: Boolean = false
    ) {
        synchronized(queueLock) {
            val current = getAllChannelStats().toMutableMap()
            val prev = current[source] ?: ChannelStats(source = source)
            val updated = prev.copy(
                source = source,
                lastCaptureMYT = timestampMYT,
                lastSyncMYT = if (syncedSuccess) timestampMYT else prev.lastSyncMYT,
                lastSender = sender,
                lastStatus = status,
                lastDetail = detail.take(180),
                syncedCount = if (syncedSuccess) prev.syncedCount + 1 else prev.syncedCount
            )
            current[source] = updated
            runCatching {
                putEncryptedString(KEY_CHANNEL_STATS, json.encodeToString(current))
            }
        }
    }

    fun isDuplicateOrInQueue(dedupeKey: String): Boolean {
        synchronized(queueLock) {
            val nowMs = System.currentTimeMillis()
            val entries = loadDedupeEntriesLocked().filterValues { (nowMs - it) < DEDUPE_TTL_MS }
            if (dedupeKey in entries) return true
            val queue = getPendingSyncQueueLocked()
            return queue.any { it.dedupeKey == dedupeKey }
        }
    }

    fun markDedupeSynced(dedupeKey: String) {
        synchronized(queueLock) {
            val nowMs = System.currentTimeMillis()
            val filtered = loadDedupeEntriesLocked()
                .filterValues { (nowMs - it) < DEDUPE_TTL_MS }
                .toMutableMap()
            filtered[dedupeKey] = nowMs
            val trimmed = if (filtered.size > MAX_DEDUPE_ENTRIES) {
                filtered.entries.sortedByDescending { it.value }.take(MAX_DEDUPE_ENTRIES)
                    .associate { it.key to it.value }
            } else {
                filtered
            }
            runCatching {
                prefs.edit().putString(KEY_DEDUPE_ENTRIES, json.encodeToString(trimmed)).apply()
            }
        }
    }

    fun getPendingSyncQueue(): List<PendingSyncItem> {
        synchronized(queueLock) {
            return getPendingSyncQueueLocked()
        }
    }

    fun enqueuePendingSync(item: PendingSyncItem): Boolean {
        synchronized(queueLock) {
            val queue = getPendingSyncQueueLocked().toMutableList()
            if (queue.any { it.dedupeKey == item.dedupeKey }) return false
            queue.add(item)
            val bounded = if (queue.size > MAX_QUEUE_SIZE) queue.takeLast(MAX_QUEUE_SIZE) else queue
            savePendingQueueLocked(bounded)
            return true
        }
    }

    fun removePendingSync(id: String) {
        synchronized(queueLock) {
            val updated = getPendingSyncQueueLocked().filterNot { it.id == id }
            savePendingQueueLocked(updated)
        }
    }

    fun markPendingRetryFailure(id: String, error: String) {
        synchronized(queueLock) {
            val updated = getPendingSyncQueueLocked().map { item ->
                if (item.id == id) {
                    item.copy(retryCount = item.retryCount + 1, lastError = error.take(160))
                } else {
                    item
                }
            }
            savePendingQueueLocked(updated)
        }
    }

    private fun loadDedupeEntriesLocked(): Map<String, Long> {
        val raw = prefs.getString(KEY_DEDUPE_ENTRIES, null) ?: return emptyMap()
        return runCatching { json.decodeFromString<Map<String, Long>>(raw) }.getOrDefault(emptyMap())
    }

    private fun getPendingSyncQueueLocked(): List<PendingSyncItem> {
        val raw = getDecryptedString(KEY_PENDING_QUEUE) ?: return emptyList()
        return runCatching { json.decodeFromString<List<PendingSyncItem>>(raw) }.getOrDefault(emptyList())
    }

    private fun savePendingQueueLocked(items: List<PendingSyncItem>) {
        runCatching {
            putEncryptedString(KEY_PENDING_QUEUE, json.encodeToString(items))
        }
    }

    fun isLocalRedactEnabled(): Boolean = prefs.getBoolean(KEY_REDACT_LOCAL, true)

    fun isSourceLocallyEnabled(source: String): Boolean {
        return when (source) {
            "wechat" -> prefs.getBoolean(KEY_WECHAT_ENABLED, true)
            "whatsapp" -> prefs.getBoolean(KEY_WHATSAPP_ENABLED, true)
            else -> true
        }
    }

    fun isSenderLocallyBlocked(sender: String): Boolean {
        val set = prefs.getStringSet(KEY_BLOCKED_SENDERS, emptySet()) ?: emptySet()
        return sender.trim().lowercase() in set
    }
}
