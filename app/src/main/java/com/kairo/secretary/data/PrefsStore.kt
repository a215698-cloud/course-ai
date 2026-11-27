package com.kairo.secretary.data

import android.content.Context
import com.kairo.secretary.BuildConfig
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class PrefsStore(context: Context) {
    private val prefs = context.getSharedPreferences("kairo_secretary_prefs", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private const val KEY_BACKEND_URL = "backend_url"
        private const val KEY_LANGUAGE = "ui_language"
        private const val KEY_CACHED_STATE = "cached_state_json"
        private const val KEY_REDACT_LOCAL = "local_redact"
        private const val KEY_WECHAT_ENABLED = "local_wechat_enabled"
        private const val KEY_WHATSAPP_ENABLED = "local_whatsapp_enabled"
        private const val KEY_BLOCKED_SENDERS = "local_blocked_senders"
    }

    fun getBackendUrl(): String {
        val saved = prefs.getString(KEY_BACKEND_URL, null)?.trim()
        return if (!saved.isNullOrBlank()) saved.trimEnd('/') else BuildConfig.DEFAULT_BACKEND_URL.trimEnd('/')
    }

    fun setBackendUrl(url: String) {
        val clean = url.trim().trimEnd('/')
        if (clean.startsWith("https://") || clean.startsWith("http://")) {
            prefs.edit().putString(KEY_BACKEND_URL, clean).apply()
        }
    }

    fun getLanguage(): String {
        return prefs.getString(KEY_LANGUAGE, "en") ?: "en"
    }

    fun setLanguage(lang: String) {
        prefs.edit().putString(KEY_LANGUAGE, lang).apply()
    }

    fun getCachedState(): SecretaryState? {
        val raw = prefs.getString(KEY_CACHED_STATE, null) ?: return null
        return runCatching { json.decodeFromString<SecretaryState>(raw) }.getOrNull()
    }

    fun saveCachedState(state: SecretaryState) {
        runCatching {
            val encoded = json.encodeToString(state)
            prefs.edit()
                .putString(KEY_CACHED_STATE, encoded)
                .putBoolean(KEY_REDACT_LOCAL, state.privacy.redactSensitiveInfo)
                .putBoolean(KEY_WECHAT_ENABLED, state.privacy.enabledSources["wechat"] ?: true)
                .putBoolean(KEY_WHATSAPP_ENABLED, state.privacy.enabledSources["whatsapp"] ?: true)
                .putStringSet(KEY_BLOCKED_SENDERS, state.privacy.blockedSenders.map { it.lowercase() }.toSet())
                .apply()
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
