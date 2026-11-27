package com.kairo.secretary.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SecretaryApiClient(private val prefsStore: PrefsStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val mediaJson = "application/json; charset=utf-8".toMediaType()

    private fun baseUrl(): String = prefsStore.getBackendUrl()

    suspend fun fetchState(): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/state")
            .get()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun ingestMessage(request: IngestRequest): IngestResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(request).toRequestBody(mediaJson)
        val req = Request.Builder()
            .url("${baseUrl()}/api/messages/ingest")
            .post(body)
            .build()
        execute<IngestResponse>(req)
    }

    suspend fun loadSampleMessages(uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/messages/load-samples")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun markMessageRead(id: String, read: Boolean): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("read", read) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/messages/$id/read")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteMessage(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/messages/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun createTask(payload: CreateTaskRequest): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/tasks")
            .post(json.encodeToString(payload).toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun updateTaskStatus(id: String, status: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("status", status) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/tasks/$id")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun dismissTaskReminder(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("reminderDismissed", true) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/tasks/$id")
            .patch(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteTask(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/tasks/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun applyScheduleChange(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/schedule-changes/$id/apply")
            .post("{}".toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun dismissScheduleChange(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/schedule-changes/$id/dismiss")
            .post("{}".toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun runCrossAnalysis(uiLanguage: String): StateWrappedResponse = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/ai/cross-analyze")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req)
    }

    suspend fun generateBriefing(uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("uiLanguage", uiLanguage) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/briefings/generate")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun sendChat(message: String, uiLanguage: String): SecretaryState = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ChatRequest(message, uiLanguage)).toRequestBody(mediaJson)
        val req = Request.Builder()
            .url("${baseUrl()}/api/ai/chat")
            .post(body)
            .build()
        execute<StateWrappedResponse>(req).state ?: fetchState()
    }

    suspend fun applyChatAction(chatMessageId: String, actionIndex: Int): SecretaryState = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ApplyChatActionRequest(chatMessageId, actionIndex)).toRequestBody(mediaJson)
        val req = Request.Builder()
            .url("${baseUrl()}/api/ai/chat/apply-action")
            .post(body)
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun clearChat(): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/ai/chat")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun addMemory(payload: CreateMemoryRequest): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/memories")
            .post(json.encodeToString(payload).toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun deleteMemory(id: String): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/memories/$id")
            .delete()
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun updatePrivacy(patch: JsonObject): SecretaryState = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${baseUrl()}/api/privacy")
            .patch(patch.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    suspend fun resetWorkspace(mode: String): SecretaryState = withContext(Dispatchers.IO) {
        val payload = buildJsonObject { put("mode", mode) }
        val req = Request.Builder()
            .url("${baseUrl()}/api/reset")
            .post(payload.toString().toRequestBody(mediaJson))
            .build()
        execute<SecretaryState>(req)
    }

    private inline fun <reified T> execute(request: Request): T {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val errMsg = runCatching { json.decodeFromString<ErrorPayload>(raw).error }.getOrNull()
                throw IllegalStateException(errMsg ?: "HTTP ${response.code}: ${response.message}")
            }
            return json.decodeFromString<T>(raw)
        }
    }
}
