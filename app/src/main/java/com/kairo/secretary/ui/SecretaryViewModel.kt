package com.kairo.secretary.ui

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kairo.secretary.data.ApiClassifiedException
import com.kairo.secretary.data.ChannelStats
import com.kairo.secretary.data.ConnectionErrorType
import com.kairo.secretary.data.CreateMemoryRequest
import com.kairo.secretary.data.CreateTaskRequest
import com.kairo.secretary.data.IngestRequest
import com.kairo.secretary.data.ListenerDiagnostic
import com.kairo.secretary.data.PiiRedactor
import com.kairo.secretary.data.PrefsStore
import com.kairo.secretary.data.SecretaryApiClient
import com.kairo.secretary.data.SecretaryState
import com.kairo.secretary.data.SyncEventBus
import com.kairo.secretary.data.UnauthorizedException
import com.kairo.secretary.notifications.DeadlineNotifier
import com.kairo.secretary.notifications.KeepAliveForegroundService
import com.kairo.secretary.notifications.PendingMessageSyncWorker
import com.kairo.secretary.notifications.SecretaryNotificationListenerService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

data class MainUiState(
    val secretaryState: SecretaryState = SecretaryState(),
    val language: String = "en",
    val backendUrl: String = "",
    val recentUrls: List<String> = emptyList(),
    val isLoading: Boolean = false,
    val isBusy: Boolean = false,
    val isTestingConnection: Boolean = false,
    val connectionStatus: String? = null,
    val connectionOk: Boolean? = null,
    val connectionErrorType: ConnectionErrorType = ConnectionErrorType.NONE,
    val aiServiceHealthy: Boolean = true,
    val authClaimed: Boolean = true,
    val isAuthenticated: Boolean = false,
    val listenerEnabled: Boolean = false,
    val listenerServiceBound: Boolean = false,
    val lastListenerBoundMYT: String? = null,
    val batteryOptimizationIgnored: Boolean = false,
    val keepAliveEnabled: Boolean = false,
    val pendingQueueCount: Int = 0,
    val lastSyncTimeMYT: String? = null,
    val wechatInstalled: Boolean = false,
    val whatsappInstalled: Boolean = false,
    val wechatStat: ChannelStats? = null,
    val whatsappStat: ChannelStats? = null,
    val listenerDiagnostic: ListenerDiagnostic? = null,
    val statusBanner: String? = null,
    val errorMessage: String? = null
)

class SecretaryViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = PrefsStore(application)
    private val api = SecretaryApiClient(prefs)
    private val connectivityManager = application.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private var initialNetworkSeen = false

    private val _uiState = MutableStateFlow(buildInitialUiState(application))
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (!initialNetworkSeen) {
                initialNetworkSeen = true
                return
            }
            val current = _uiState.value
            if (current.backendUrl.isNotBlank() && (current.connectionOk != true || current.pendingQueueCount > 0)) {
                checkConnectionAndSync()
            }
        }
    }

    init {
        viewModelScope.launch {
            SyncEventBus.events.collect {
                refreshLocalBridgeState()
                if (_uiState.value.isAuthenticated && prefs.getBackendUrl().isNotBlank()) {
                    refreshState()
                }
            }
        }

        runCatching {
            connectivityManager?.registerDefaultNetworkCallback(networkCallback)
        }

        if (prefs.isKeepAliveEnabled() && DeadlineNotifier.isNotificationListenerEnabled(application)) {
            KeepAliveForegroundService.start(application)
        }

        if (prefs.getBackendUrl().isNotBlank()) {
            checkConnectionAndSync()
        }
    }

    override fun onCleared() {
        runCatching { connectivityManager?.unregisterNetworkCallback(networkCallback) }
        super.onCleared()
    }

    private fun buildInitialUiState(context: Context): MainUiState {
        val stats = prefs.getAllChannelStats()
        val whatsappPkgInstalled = DeadlineNotifier.isPackageInstalled(
            context,
            SecretaryNotificationListenerService.WHATSAPP_PACKAGE
        ) || DeadlineNotifier.isPackageInstalled(
            context,
            SecretaryNotificationListenerService.WHATSAPP_BUSINESS_PACKAGE
        )
        return MainUiState(
            secretaryState = prefs.getCachedState() ?: SecretaryState(),
            language = prefs.getLanguage(),
            backendUrl = prefs.getBackendUrl(),
            recentUrls = prefs.getRecentBackendUrls(),
            isLoading = prefs.getBackendUrl().isNotBlank() && prefs.getCachedState() == null,
            connectionErrorType = if (prefs.getBackendUrl().isBlank()) ConnectionErrorType.NOT_CONFIGURED else ConnectionErrorType.NONE,
            isAuthenticated = !prefs.getAuthToken().isNullOrBlank(),
            listenerEnabled = DeadlineNotifier.isNotificationListenerEnabled(context),
            listenerServiceBound = prefs.isListenerServiceBound(),
            lastListenerBoundMYT = prefs.getLastListenerBoundTimeMYT(),
            batteryOptimizationIgnored = DeadlineNotifier.isIgnoringBatteryOptimizations(context),
            keepAliveEnabled = prefs.isKeepAliveEnabled(),
            pendingQueueCount = prefs.getPendingSyncQueue().size,
            lastSyncTimeMYT = prefs.getLastSyncTimeMYT(),
            wechatInstalled = DeadlineNotifier.isPackageInstalled(
                context,
                SecretaryNotificationListenerService.WECHAT_PACKAGE
            ),
            whatsappInstalled = whatsappPkgInstalled,
            wechatStat = stats["wechat"],
            whatsappStat = stats["whatsapp"],
            listenerDiagnostic = prefs.getListenerDiagnostic()
        )
    }

    fun refreshLocalBridgeState() {
        val app = getApplication<Application>()
        val stats = prefs.getAllChannelStats()
        val enabled = DeadlineNotifier.isNotificationListenerEnabled(app)
        val whatsappPkgInstalled = DeadlineNotifier.isPackageInstalled(
            app,
            SecretaryNotificationListenerService.WHATSAPP_PACKAGE
        ) || DeadlineNotifier.isPackageInstalled(
            app,
            SecretaryNotificationListenerService.WHATSAPP_BUSINESS_PACKAGE
        )
        _uiState.update {
            it.copy(
                listenerEnabled = enabled,
                listenerServiceBound = prefs.isListenerServiceBound(),
                lastListenerBoundMYT = prefs.getLastListenerBoundTimeMYT(),
                batteryOptimizationIgnored = DeadlineNotifier.isIgnoringBatteryOptimizations(app),
                keepAliveEnabled = prefs.isKeepAliveEnabled(),
                pendingQueueCount = prefs.getPendingSyncQueue().size,
                lastSyncTimeMYT = prefs.getLastSyncTimeMYT(),
                wechatInstalled = DeadlineNotifier.isPackageInstalled(
                    app,
                    SecretaryNotificationListenerService.WECHAT_PACKAGE
                ),
                whatsappInstalled = whatsappPkgInstalled,
                wechatStat = stats["wechat"],
                whatsappStat = stats["whatsapp"],
                listenerDiagnostic = prefs.getListenerDiagnostic(),
                recentUrls = prefs.getRecentBackendUrls()
            )
        }
    }

    fun onAppResumed() {
        refreshLocalBridgeState()
        if (_uiState.value.listenerEnabled && !_uiState.value.listenerServiceBound) {
            DeadlineNotifier.requestListenerRebind(getApplication())
        }
        if (_uiState.value.isAuthenticated && prefs.getBackendUrl().isNotBlank()) {
            refreshState()
            if (prefs.getPendingSyncQueue().isNotEmpty()) {
                PendingMessageSyncWorker.schedule(getApplication(), immediate = true)
            }
        }
    }

    fun rebindListener() {
        val requested = DeadlineNotifier.requestListenerRebind(getApplication())
        refreshLocalBridgeState()
        _uiState.update {
            it.copy(
                statusBanner = if (requested) {
                    "Requested Android OS to rebind notification listener."
                } else {
                    "Grant notification listener permission first."
                }
            )
        }
    }

    fun toggleKeepAlive(enabled: Boolean) {
        val app = getApplication<Application>()
        prefs.setKeepAliveEnabled(enabled)
        if (enabled) {
            val started = KeepAliveForegroundService.start(app)
            _uiState.update {
                it.copy(
                    keepAliveEnabled = enabled,
                    statusBanner = if (started) "Background guard notification enabled." else "Unable to start guard service."
                )
            }
        } else {
            KeepAliveForegroundService.stop(app)
            _uiState.update {
                it.copy(
                    keepAliveEnabled = false,
                    statusBanner = "Background guard notification disabled."
                )
            }
        }
    }

    fun retryPendingQueue() {
        val count = prefs.getPendingSyncQueue().size
        if (count == 0) {
            _uiState.update { it.copy(statusBanner = "Offline retry queue is empty.") }
            return
        }
        if (!isNetworkConnected()) {
            _uiState.update {
                it.copy(
                    connectionErrorType = ConnectionErrorType.NETWORK_ERROR,
                    errorMessage = "Device appears offline. Messages stay queued and will auto-sync when internet returns."
                )
            }
            return
        }
        PendingMessageSyncWorker.schedule(getApplication(), immediate = true)
        _uiState.update { it.copy(statusBanner = "Retrying $count queued message(s)...") }
    }

    private fun isNetworkConnected(): Boolean {
        val cm = connectivityManager ?: return true
        val active = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(active) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun setLanguage(lang: String) {
        prefs.setLanguage(lang)
        _uiState.update { it.copy(language = lang) }
    }

    fun saveBackendUrl(rawUrl: String) {
        val result = prefs.saveBackendUrl(rawUrl)
        result
            .onSuccess { clean ->
                _uiState.update {
                    it.copy(
                        backendUrl = clean,
                        recentUrls = prefs.getRecentBackendUrls(),
                        isAuthenticated = !prefs.getAuthToken().isNullOrBlank(),
                        connectionStatus = null,
                        connectionOk = null,
                        connectionErrorType = ConnectionErrorType.NONE,
                        statusBanner = "Backend URL saved: $clean"
                    )
                }
                checkConnectionAndSync()
            }
            .onFailure { err ->
                _uiState.update {
                    it.copy(
                        connectionOk = false,
                        connectionErrorType = ConnectionErrorType.NOT_CONFIGURED,
                        connectionStatus = err.message,
                        errorMessage = err.message ?: "Invalid backend URL"
                    )
                }
            }
    }

    fun testConnection(rawUrl: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingConnection = true, errorMessage = null) }
            val normalized = prefs.normalizeBackendUrl(rawUrl)
            if (normalized.isFailure) {
                val msg = normalized.exceptionOrNull()?.message ?: "Invalid URL"
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        connectionOk = false,
                        connectionErrorType = ConnectionErrorType.NOT_CONFIGURED,
                        connectionStatus = msg,
                        errorMessage = msg
                    )
                }
                return@launch
            }
            val targetUrl = normalized.getOrThrow()
            runCatching {
                val health = api.testConnection(targetUrl)
                val auth = api.getAuthStatus(targetUrl)
                health to auth
            }.onSuccess { (health, auth) ->
                prefs.saveBackendUrl(targetUrl)
                val aiReady = health.aiConfigured
                val statusMsg = formatConnectionSummary(health)
                val errType = when {
                    !aiReady -> ConnectionErrorType.AI_SERVICE_ERROR
                    !auth.authenticated -> ConnectionErrorType.AUTH_FAILED
                    else -> ConnectionErrorType.NONE
                }
                _uiState.update {
                    it.copy(
                        backendUrl = targetUrl,
                        recentUrls = prefs.getRecentBackendUrls(),
                        isTestingConnection = false,
                        connectionOk = health.ok,
                        connectionErrorType = errType,
                        aiServiceHealthy = aiReady,
                        connectionStatus = statusMsg,
                        authClaimed = auth.claimed,
                        isAuthenticated = auth.authenticated,
                        statusBanner = statusMsg
                    )
                }
                if (auth.authenticated) {
                    refreshState()
                    if (prefs.getPendingSyncQueue().isNotEmpty()) {
                        PendingMessageSyncWorker.schedule(getApplication(), immediate = true)
                    }
                }
            }.onFailure { err ->
                val classified = classifyThrowable(err)
                _uiState.update {
                    it.copy(
                        isTestingConnection = false,
                        connectionOk = false,
                        connectionErrorType = classified,
                        connectionStatus = err.message ?: "Connection failed",
                        errorMessage = err.message ?: "Connection failed"
                    )
                }
            }
        }
    }

    private fun formatConnectionSummary(health: com.kairo.secretary.data.HealthResponse): String {
        val aiNote = if (health.aiConfigured) "Gemini Ready" else "GEMINI_API_KEY missing on server"
        val storageNote = if (health.runningOnCloudRun && !health.persistentVolumeConfigured) {
            "${health.storageEngine.uppercase()} (Ephemeral Cloud Run disk - mount KAIRO_DATA_DIR or set KAIRO_ACCESS_PASSCODE)"
        } else {
            health.storageEngine.uppercase()
        }
        return "Connected ($storageNote · ${health.timezone} · $aiNote)"
    }

    fun checkConnectionAndSync() {
        if (prefs.getBackendUrl().isBlank()) {
            _uiState.update {
                it.copy(isLoading = false, connectionErrorType = ConnectionErrorType.NOT_CONFIGURED)
            }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(errorMessage = null) }
            runCatching {
                val health = api.testConnection()
                val auth = api.getAuthStatus()
                health to auth
            }.onSuccess { (health, auth) ->
                val aiReady = health.aiConfigured
                val errType = when {
                    !aiReady -> ConnectionErrorType.AI_SERVICE_ERROR
                    !auth.authenticated -> ConnectionErrorType.AUTH_FAILED
                    else -> ConnectionErrorType.NONE
                }
                _uiState.update {
                    it.copy(
                        connectionOk = health.ok,
                        connectionErrorType = errType,
                        aiServiceHealthy = aiReady,
                        connectionStatus = formatConnectionSummary(health),
                        authClaimed = auth.claimed,
                        isAuthenticated = auth.authenticated
                    )
                }
                if (auth.authenticated) {
                    refreshState()
                    if (prefs.getPendingSyncQueue().isNotEmpty()) {
                        PendingMessageSyncWorker.schedule(getApplication(), immediate = true)
                    }
                } else {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }.onFailure { err ->
                val classified = classifyThrowable(err)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        connectionOk = false,
                        connectionErrorType = classified,
                        connectionStatus = err.message,
                        errorMessage = err.message
                    )
                }
            }
        }
    }

    private fun classifyThrowable(err: Throwable): ConnectionErrorType {
        if (err is ApiClassifiedException) return err.errorType
        return if (!isNetworkConnected()) ConnectionErrorType.NETWORK_ERROR else ConnectionErrorType.SERVER_OFFLINE
    }

    fun submitPasscode(passcode: String, isClaim: Boolean) {
        val clean = passcode.trim()
        if (clean.length < 6) {
            _uiState.update { it.copy(errorMessage = "Passcode must be at least 6 characters.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isBusy = true, errorMessage = null) }
            runCatching {
                if (isClaim) api.claimPasscode(clean) else api.loginWithPasscode(clean)
            }.onSuccess { res ->
                prefs.setAuthToken(res.token)
                _uiState.update {
                    it.copy(
                        isBusy = false,
                        authClaimed = true,
                        isAuthenticated = true,
                        connectionErrorType = if (it.aiServiceHealthy) ConnectionErrorType.NONE else ConnectionErrorType.AI_SERVICE_ERROR,
                        statusBanner = "Workspace unlocked"
                    )
                }
                refreshState()
                if (prefs.getPendingSyncQueue().isNotEmpty()) {
                    PendingMessageSyncWorker.schedule(getApplication(), immediate = true)
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isBusy = false,
                        connectionErrorType = classifyThrowable(err),
                        errorMessage = err.message ?: "Authentication failed"
                    )
                }
            }
        }
    }

    fun logout() {
        prefs.clearAuthToken()
        _uiState.update {
            it.copy(
                isAuthenticated = false,
                connectionErrorType = ConnectionErrorType.AUTH_FAILED,
                statusBanner = "Workspace locked"
            )
        }
    }

    fun clearBanner() {
        _uiState.update { it.copy(statusBanner = null, errorMessage = null) }
    }

    fun refreshState() {
        if (prefs.getBackendUrl().isBlank()) {
            _uiState.update { it.copy(isLoading = false) }
            return
        }
        viewModelScope.launch {
            runCatching { api.fetchState() }
                .onSuccess { fresh ->
                    prefs.saveCachedState(fresh)
                    val nowMyt = ZonedDateTime.now(ZoneId.of("Asia/Kuala_Lumpur"))
                        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'MYT'"))
                    prefs.setLastSyncTimeMYT(nowMyt)
                    _uiState.update {
                        it.copy(
                            secretaryState = fresh,
                            isLoading = false,
                            isAuthenticated = true,
                            connectionOk = true,
                            connectionErrorType = if (it.aiServiceHealthy) ConnectionErrorType.NONE else ConnectionErrorType.AI_SERVICE_ERROR,
                            lastSyncTimeMYT = nowMyt,
                            pendingQueueCount = prefs.getPendingSyncQueue().size,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { err ->
                    handleApiFailure(err, stopLoading = true)
                }
        }
    }

    private fun handleApiFailure(err: Throwable, stopLoading: Boolean = false) {
        val errType = classifyThrowable(err)
        if (err is UnauthorizedException) {
            prefs.clearAuthToken()
            _uiState.update {
                it.copy(
                    isLoading = if (stopLoading) false else it.isLoading,
                    isBusy = false,
                    isAuthenticated = false,
                    authClaimed = err.claimed,
                    connectionErrorType = ConnectionErrorType.AUTH_FAILED,
                    errorMessage = err.message
                )
            }
        } else {
            _uiState.update {
                it.copy(
                    isLoading = if (stopLoading) false else it.isLoading,
                    isBusy = false,
                    connectionOk = if (errType == ConnectionErrorType.AI_SERVICE_ERROR) it.connectionOk else false,
                    connectionErrorType = errType,
                    errorMessage = err.message ?: "Request failed"
                )
            }
        }
    }

    private fun runMutation(
        successToast: String? = null,
        onError: (() -> Unit)? = null,
        block: suspend () -> SecretaryState
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isBusy = true, errorMessage = null) }
            runCatching { block() }
                .onSuccess { fresh ->
                    prefs.saveCachedState(fresh)
                    val nowMyt = ZonedDateTime.now(ZoneId.of("Asia/Kuala_Lumpur"))
                        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'MYT'"))
                    prefs.setLastSyncTimeMYT(nowMyt)
                    _uiState.update {
                        it.copy(
                            secretaryState = fresh,
                            isBusy = false,
                            isAuthenticated = true,
                            connectionOk = true,
                            connectionErrorType = ConnectionErrorType.NONE,
                            aiServiceHealthy = true,
                            lastSyncTimeMYT = nowMyt,
                            statusBanner = successToast
                        )
                    }
                }
                .onFailure { err ->
                    onError?.invoke()
                    handleApiFailure(err)
                }
        }
    }

    fun ingestManualMessage(source: String, sender: String, chatTitle: String, rawText: String) {
        val safeText = if (prefs.isLocalRedactEnabled()) PiiRedactor.redact(rawText) else rawText
        val mytNow = ZonedDateTime.now(ZoneId.of("Asia/Kuala_Lumpur"))
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        runMutation("Message analyzed") {
            val res = api.ingestMessage(
                IngestRequest(
                    source = source,
                    sender = sender.ifBlank { "Direct Contact" },
                    chatTitle = chatTitle.ifBlank { null },
                    rawText = safeText,
                    receivedAt = mytNow,
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
                            connectionErrorType = ConnectionErrorType.NONE,
                            statusBanner = if (count > 0) "Detected $count schedule alert(s)" else "No new schedule conflicts"
                        )
                    }
                }
                .onFailure { err ->
                    handleApiFailure(err)
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

    fun sendChat(message: String, onSuccess: () -> Unit = {}) {
        runMutation {
            val res = api.sendChat(message, _uiState.value.language)
            onSuccess()
            res
        }
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
