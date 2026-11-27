package com.kairo.secretary.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.ConnectionSpec
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLException

open class ApiClassifiedException(
    val errorType: ConnectionErrorType,
    override val message: String,
    val claimed: Boolean = true
) : IllegalStateException(message)

class BackendNotConfiguredException :
    ApiClassifiedException(
        ConnectionErrorType.NOT_CONFIGURED,
        "Backend server URL is not configured yet. Set a valid HTTPS URL in Privacy & Bridge."
    )

class UnauthorizedException(message: String, claimed: Boolean = true) :
    ApiClassifiedException(ConnectionErrorType.AUTH_FAILED, message, claimed)

class BackendNotFoundException(url: String) :
    ApiClassifiedException(
        ConnectionErrorType.SERVER_OFFLINE,
        "Server returned HTTP 404 at $url. Confirm your Kairo backend is deployed and running."
    )

class AuthRedirectException(location: String?) :
    ApiClassifiedException(
        ConnectionErrorType.NETWORK_ERROR,
        "Server redirected to ${location ?: "Google login"} (HTTP 302). " +
            "AI Studio ais-dev preview URLs block mobile requests; deploy to Cloud Run for a public HTTPS URL."
    )

class SecretaryApiClient(private val prefsStore: PrefsStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectionSpecs(listOf(ConnectionSpec.MODERN_TLS, ConnectionSpec.CLEARTEXT))
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    private val mediaJson = "application/json; charset=utf-8".toMediaType()

    private fun requireBaseUrl(): String {
        val url = prefsStore.getBackendUrl()
        if (url.isBlank()) throw BackendNotConfiguredException()
        return url
    }

    private fun requestBuilder(fullUrl: String, requiresAuth: Boolean = true): Request.Builder {
        val builder = Request.Builder()
            .url(fullUrl)
            .header("Accept", "application/json")
        if (requiresAuth) {
            val token = prefsStore.getAuthToken()
            if (!token.isNullOrBlank()) {
                builder.header("Authorization", "Bearer $token")
            }
        }
        return builder
    }

    suspend fun testConnection(overrideUrl: String? = null): HealthResponse = withContext(Dispatchers.IO) {
        val targetBase = if (!overrideUrl.isNullOrBlank()) {
            prefsStore.normalizeBackendUrl(overrideUrl).getOrElse {
                throw ApiClassifiedException(ConnectionErrorType.NOT_CONFIGURED, it.message ?: "Invalid URL")
            }
        } else {
            requireBaseUrl()
        }
        val req = requestBuilder("$targetBase/api/health", requiresAuth = false)
            .get()
            .build()
        execute<HealthResponse>(req)
    }

    suspend fun getAuthStatus(overrideUrl: String? = null): AuthStatusResponse = withContext(Dispatchers.IO) {
        val targetBase = if (!overrideUrl.isNullOrBlank()) {
            prefsStore.normalizeBackendUrl(overrideUrl).getOrElse {
                throw ApiClassifiedException(ConnectionErrorType.NOT_CONFIGURED, it.message ?: "Invalid URL")
            }
        } else {
            requireBaseUrl()
        }
        val req = requestBuilder("$targetBase/api/auth/status", requiresAuth = true)
            .get()
            .build()
        execute<AuthStatusResponse>(req)
    }

    suspend fun claimPasscode(passcode: String): AuthTokenResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(AuthPasscodeRequest(passcode)).toRequestBody(mediaJson)
        val req = requestBuilder("${requireBaseUrl()}/api/auth/claim", requiresAuth = false)
            .post(body)
            .build()
        execute<AuthTokenResponse>(req)
    }

    suspend fun loginWithPasscode(passcode: String): AuthTokenResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(AuthPasscodeRequest(passcode)).toRequestBody(mediaJson)
        val req = requestBuilder("${requireBaseUrl()}/api/auth/login", requiresAuth = false)
            .post(body)
            .build()
        execute<AuthTokenResponse>(req)
    }

    suspend fun fetchState(): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/state")
            .get()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun ingestMessage(request: IngestRequest): IngestResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(request).toRequestBody(mediaJson)
        val req = requestBuilder("${requireBaseUrl()}/api/messages/ingest")
            .post(body)
            .build()
        execute<IngestResponse>(req)
    }

    suspend fun loadSampleMessages(uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = requestBuilder("${requireBaseUrl()}/api/messages/load-samples")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun markMessageRead(id: String, read: Boolean): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("read", read) }
        val req = requestBuilder("${requireBaseUrl()}/api/messages/$id/read")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteMessage(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/messages/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun createTask(payload: CreateTaskRequest): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/tasks")
            .post(json.encodeToString(payload).toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun updateTaskStatus(id: String, status: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("status", status) }
        val req = requestBuilder("${requireBaseUrl()}/api/tasks/$id")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun dismissTaskReminder(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("reminderDismissed", true) }
        val req = requestBuilder("${requireBaseUrl()}/api/tasks/$id")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteTask(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/tasks/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun applyScheduleChange(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/schedule-changes/$id/apply")
            .post("{}".toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun dismissScheduleChange(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/schedule-changes/$id/dismiss")
            .post("{}".toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun runCrossAnalysis(uiLanguage: String): StateWrappedResponse = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = requestBuilder("${requireBaseUrl()}/api/ai/cross-analyze")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req)
    }

    suspend fun generateBriefing(uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = requestBuilder("${requireBaseUrl()}/api/briefings/generate")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun sendChat(message: String, uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ChatRequest(message, uiLanguage)).toRequestBody(mediaJson)
        val req = requestBuilder("${requireBaseUrl()}/api/ai/chat")
            .post(body)
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun applyChatAction(chatMessageId: String, actionIndex: Int): SecretaryState = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ApplyChatActionRequest(chatMessageId, actionIndex)).toRequestBody(mediaJson)
        val req = requestBuilder("${requireBaseUrl()}/api/ai/chat/apply-action")
            .post(body)
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun clearChat(): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/ai/chat")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun addMemory(payload: CreateMemoryRequest): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/memories")
            .post(json.encodeToString(payload).toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteMemory(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/memories/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun updatePrivacy(patch: JsonObject): SecretaryState = withContext(Dispatchers.IO) {
        val req = requestBuilder("${requireBaseUrl()}/api/privacy")
            .patch(patch.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun resetWorkspace(mode: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("mode", mode) }
        val req = requestBuilder("${requireBaseUrl()}/api/reset")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    private inline fun <reified T> execute(request: Request): T {
        val response = try {
            client.newCall(request).execute()
        } catch (e: ConnectException) {
            throw ApiClassifiedException(
                ConnectionErrorType.SERVER_OFFLINE,
                "Server unreachable (${e.message ?: "connection refused"}). Check that your backend is running."
            )
        } catch (e: UnknownHostException) {
            throw ApiClassifiedException(
                ConnectionErrorType.NETWORK_ERROR,
                "DNS lookup failed for ${request.url.host}. Check your phone Wi-Fi/5G connection and URL spelling."
            )
        } catch (e: SocketTimeoutException) {
            throw ApiClassifiedException(
                ConnectionErrorType.NETWORK_ERROR,
                "Connection timed out waiting for ${request.url.host}. Check network stability or server cold start."
            )
        } catch (e: SSLException) {
            throw ApiClassifiedException(
                ConnectionErrorType.NETWORK_ERROR,
                "TLS/SSL error connecting to ${request.url.host}: ${e.message ?: "certificate check failed"}."
            )
        } catch (e: IOException) {
            throw ApiClassifiedException(
                ConnectionErrorType.NETWORK_ERROR,
                "Network error: ${e.message ?: "unable to reach server"}."
            )
        }

        response.use { res ->
            if (res.isRedirect) {
                throw AuthRedirectException(res.header("Location"))
            }

            val contentType = res.header("Content-Type").orEmpty().lowercase()
            val raw = res.body?.string().orEmpty()

            if (res.code == 401) {
                val payload = runCatching { json.decodeFromString<ErrorPayload>(raw) }.getOrNull()
                throw UnauthorizedException(
                    payload?.error ?: "Authentication failed. Please sign in with your workspace passcode.",
                    claimed = payload?.claimed ?: true
                )
            }

            if (res.code == 404 && !contentType.contains("application/json")) {
                throw BackendNotFoundException(request.url.toString())
            }

            if (res.code in listOf(502, 504)) {
                throw ApiClassifiedException(
                    ConnectionErrorType.SERVER_OFFLINE,
                    "Backend gateway unavailable (HTTP ${res.code}). Server may be restarting or offline."
                )
            }

            if (!res.isSuccessful) {
                val payload = runCatching { json.decodeFromString<ErrorPayload>(raw) }.getOrNull()
                val errMsg = payload?.error ?: "HTTP ${res.code}: ${res.message}"
                if (payload?.errorCode == "AI_SERVICE_ERROR") {
                    throw ApiClassifiedException(ConnectionErrorType.AI_SERVICE_ERROR, errMsg)
                }
                if (res.code == 503) {
                    throw ApiClassifiedException(ConnectionErrorType.SERVER_OFFLINE, errMsg)
                }
                throw IllegalStateException(errMsg)
            }

            if (contentType.contains("text/html") || raw.trimStart().startsWith("<")) {
                throw ApiClassifiedException(
                    ConnectionErrorType.SERVER_OFFLINE,
                    "Server returned HTML instead of JSON API from ${request.url}. Confirm this is your deployed Kairo backend URL."
                )
            }

            return json.decodeFromString<T>(raw)
        }
    }
}
