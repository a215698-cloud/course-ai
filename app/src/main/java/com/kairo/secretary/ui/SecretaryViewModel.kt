package com.kairo.secretary.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kairo.secretary.data.CreateMemoryRequest
import com.kairo.secretary.data.CreateTaskRequest
import com.kairo.secretary.data.IngestRequest
import com.kairo.secretary.data.PiiRedactor
import com.kairo.secretary.data.PrefsStore
import com.kairo.secretary.data.SecretaryApiClient
import com.kairo.secretary.data.SecretaryState
import com.kairo.secretary.notifications.DeadlineNotifier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

data class MainUiState(
    val secretaryState: SecretaryState = SecretaryState(),
    val language: String = "en",
    val backendUrl: String = "",
    val isLoading: Boolean = true,
    val isBusy: Boolean = false,
    val listenerEnabled: Boolean = false,
    val statusBanner: String? = null,
    val errorMessage: String? = null
)

class SecretaryViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PrefsStore(application)
    private val api = SecretaryApiClient(prefs)

    private val _uiState = MutableStateFlow(
        MainUiState(
            secretaryState = prefs.getCachedState() ?: SecretaryState(),
            language = prefs.getLanguage(),
            backendUrl = prefs.getBackendUrl(),
            isLoading = prefs.getCachedState() == null,
            listenerEnabled = DeadlineNotifier.isNotificationListenerEnabled(application)
        )
    )
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        refreshState()
    }

    fun refreshListenerPermission() {
        val enabled = DeadlineNotifier.isNotificationListenerEnabled(getApplication())
        _uiState.update { it.copy(listenerEnabled = enabled) }
    }

    fun setLanguage(lang: String) {
        prefs.setLanguage(lang)
        _uiState.update { it.copy(language = lang) }
    }

    fun saveBackendUrl(url: String) {
        prefs.setBackendUrl(url)
        _uiState.update { it.copy(backendUrl = prefs.getBackendUrl(), statusBanner = "Backend URL updated") }
        refreshState()
    }

    fun clearBanner() {
        _uiState.update { it.copy(statusBanner = null, errorMessage = null) }
    }

    fun refreshState() {
        viewModelScope.launch {
            runCatching { api.fetchState() }
                .onSuccess { fresh ->
                    prefs.saveCachedState(fresh)
                    _uiState.update { it.copy(secretaryState = fresh, isLoading = false, errorMessage = null) }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(isLoading = false, errorMessage = err.message) }
                }
        }
    }

    private fun runMutation(successToast: String? = null, block: suspend () -> SecretaryState) {
        viewModelScope.launch {
            _uiState.update { it.copy(isBusy = true, errorMessage = null) }
            runCatching { block() }
                .onSuccess { fresh ->
                    prefs.saveCachedState(fresh)
                    _uiState.update {
                        it.copy(secretaryState = fresh, isBusy = false, statusBanner = successToast)
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(isBusy = false, errorMessage = err.message ?: "Request failed")
                    }
                }
        }
    }

    fun ingestManualMessage(source: String, sender: String, chatTitle: String, rawText: String) {
        val safeText = if (prefs.isLocalRedactEnabled()) PiiRedactor.redact(rawText) else rawText
        runMutation("Message analyzed") {
            val res = api.ingestMessage(
                IngestRequest(
                    source = source,
                    sender = sender.ifBlank { "Direct Contact" },
                    chatTitle = chatTitle.ifBlank { null },
                    rawText = safeText,
                    receivedAt = Instant.now().toString(),
                    uiLanguage = _uiState.value.language
                )
            )
            res.state ?: api.fetchState()
        }
    }

    fun loadSamples() {
        runMutation("Sample messages loaded") {
            api.loadSampleMessages(_uiState.value.language)
        }
    }

    fun markMessageRead(id: String, read: Boolean) {
        runMutation { api.markMessageRead(id, read) }
    }

    fun deleteMessage(id: String) {
        runMutation("Message removed") { api.deleteMessage(id) }
    }

    fun generateBriefing() {
        runMutation("Daily briefing ready") {
            api.generateBriefing(_uiState.value.language)
        }
    }

    fun runCrossAnalysis() {
        viewModelScope.launch {
            _uiState.update { it.copy(isBusy = true, errorMessage = null) }
            runCatching { api.runCrossAnalysis(_uiState.value.language) }
                .onSuccess { res ->
                    val fresh = res.state ?: api.fetchState()
                    prefs.saveCachedState(fresh)
                    val count = res.newAlertsCount ?: 0
                    _uiState.update {
                        it.copy(
                            secretaryState = fresh,
                            isBusy = false,
                            statusBanner = if (count > 0) "Detected $count schedule alert(s)" else "No new schedule conflicts"
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(isBusy = false, errorMessage = err.message) }
                }
        }
    }

    fun applyScheduleChange(id: String) {
        runMutation("Schedule updated") { api.applyScheduleChange(id) }
    }

    fun dismissScheduleChange(id: String) {
        runMutation { api.dismissScheduleChange(id) }
    }

    fun toggleTaskStatus(id: String, completed: Boolean) {
        runMutation { api.updateTaskStatus(id, if (completed) "completed" else "pending") }
    }

    fun createTask(
        title: String,
        description: String,
        category: String,
        priority: String,
        dueDate: String,
        dueTime: String,
        location: String
    ) {
        runMutation("Task saved") {
            api.createTask(
                CreateTaskRequest(
                    title = title,
                    description = description,
                    category = category,
                    priority = priority,
                    dueDate = dueDate.ifBlank { null },
                    dueTime = dueTime.ifBlank { null },
                    location = location.ifBlank { null }
                )
            )
        }
    }

    fun deleteTask(id: String) {
        runMutation("Task deleted") { api.deleteTask(id) }
    }

    fun sendChat(message: String) {
        runMutation { api.sendChat(message, _uiState.value.language) }
    }

    fun applyChatAction(chatMessageId: String, actionIndex: Int) {
        runMutation("Saved to workspace") { api.applyChatAction(chatMessageId, actionIndex) }
    }

    fun clearChat() {
        runMutation { api.clearChat() }
    }

    fun addMemory(key: String, content: String, category: String) {
        runMutation("Memory added") { api.addMemory(CreateMemoryRequest(key, content, category)) }
    }

    fun deleteMemory(id: String) {
        runMutation("Memory deleted") { api.deleteMemory(id) }
    }

    fun toggleSource(source: String, enabled: Boolean) {
        val current = _uiState.value.secretaryState.privacy.enabledSources.toMutableMap()
        current[source] = enabled
        val patch = buildJsonObject {
            put("enabledSources", buildJsonObject {
                current.forEach { (k, v) -> put(k, v) }
            })
        }
        runMutation { api.updatePrivacy(patch) }
    }

    fun toggleRedaction(enabled: Boolean) {
        val patch = buildJsonObject { put("redactSensitiveInfo", enabled) }
        runMutation { api.updatePrivacy(patch) }
    }

    fun addBlockedSender(sender: String) {
        val list = (_uiState.value.secretaryState.privacy.blockedSenders + sender).distinct()
        val patch = buildJsonObject {
            put("blockedSenders", buildJsonArray { list.forEach { add(JsonPrimitive(it)) } })
        }
        runMutation("Sender blocked") { api.updatePrivacy(patch) }
    }

    fun removeBlockedSender(sender: String) {
        val list = _uiState.value.secretaryState.privacy.blockedSenders.filter { it != sender }
        val patch = buildJsonObject {
            put("blockedSenders", buildJsonArray { list.forEach { add(JsonPrimitive(it)) } })
        }
        runMutation { api.updatePrivacy(patch) }
    }
}
