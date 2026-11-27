package com.kairo.secretary.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class ExtractedEntities(
    val dates: List<String> = emptyList(),
    val times: List<String> = emptyList(),
    val locations: List<String> = emptyList(),
    val people: List<String> = emptyList(),
    val actionItems: List<String> = emptyList()
)

@Serializable
data class IngestedMessage(
    val id: String,
    val source: String,
    val sender: String,
    val chatTitle: String? = null,
    val rawText: String = "",
    val redactedText: String = "",
    val receivedAt: String = "",
    val detectedLanguages: List<String> = emptyList(),
    val summary: String = "",
    val importance: String = "normal",
    val importanceReason: String = "",
    val entities: ExtractedEntities = ExtractedEntities(),
    val linkedTaskIds: List<String> = emptyList(),
    val isSample: Boolean? = null,
    val read: Boolean = false
)

@Serializable
data class SecretaryTask(
    val id: String,
    val title: String,
    val description: String = "",
    val category: String = "task",
    val status: String = "pending",
    val priority: String = "normal",
    val dueDate: String? = null,
    val dueTime: String? = null,
    val location: String? = null,
    val sourceMessageId: String? = null,
    val sourceApp: String = "manual",
    val sourceSender: String? = null,
    val reminderMinutesBefore: Int = 30,
    val reminderDismissed: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class ScheduleChangeAlert(
    val id: String,
    val title: String,
    val changeType: String = "rescheduled",
    val summary: String = "",
    val previousValue: String = "",
    val newValue: String = "",
    val targetTaskId: String? = null,
    val proposedDueDate: String? = null,
    val proposedDueTime: String? = null,
    val proposedLocation: String? = null,
    val sourceMessageIds: List<String> = emptyList(),
    val status: String = "pending",
    val detectedAt: String = ""
)

@Serializable
data class PersonalMemory(
    val id: String,
    val category: String = "fact",
    val key: String,
    val content: String,
    val source: String = "user",
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class DailyBriefing(
    val id: String,
    val date: String,
    val language: String = "en",
    val headline: String,
    val overview: String,
    val topPriorities: List<String> = emptyList(),
    val scheduleSummary: List<String> = emptyList(),
    val watchouts: List<String> = emptyList(),
    val generatedAt: String = ""
)

@Serializable
data class SuggestedAction(
    val type: String,
    val label: String,
    val payload: Map<String, String> = emptyMap(),
    val applied: Boolean = false
)

@Serializable
data class ChatMessage(
    val id: String,
    val role: String,
    val content: String,
    val createdAt: String = "",
    val suggestedActions: List<SuggestedAction> = emptyList()
)

@Serializable
data class PrivacySettings(
    val enabledSources: Map<String, Boolean> = mapOf(
        "whatsapp" to true,
        "wechat" to true,
        "email" to true,
        "sms" to false,
        "manual" to true
    ),
    val redactSensitiveInfo: Boolean = true,
    val blockedSenders: List<String> = emptyList(),
    val storeRawMessages: Boolean = true,
    val proactiveRemindersEnabled: Boolean = true
)

@Serializable
data class SecretaryState(
    val messages: List<IngestedMessage> = emptyList(),
    val tasks: List<SecretaryTask> = emptyList(),
    val scheduleChanges: List<ScheduleChangeAlert> = emptyList(),
    val memories: List<PersonalMemory> = emptyList(),
    val briefings: List<DailyBriefing> = emptyList(),
    val chatHistory: List<ChatMessage> = emptyList(),
    val privacy: PrivacySettings = PrivacySettings(),
    val lastCrossAnalysisAt: String? = null
)

@Serializable
data class IngestRequest(
    val source: String,
    val sender: String,
    val chatTitle: String? = null,
    val rawText: String,
    val receivedAt: String,
    val uiLanguage: String = "en"
)

@Serializable
data class IngestResponse(
    val message: IngestedMessage? = null,
    val createdTasks: List<SecretaryTask> = emptyList(),
    val detectedChanges: List<ScheduleChangeAlert> = emptyList(),
    val state: SecretaryState? = null
)

@Serializable
data class StateWrappedResponse(
    val state: SecretaryState? = null,
    val newAlertsCount: Int? = null,
    val addedCount: Int? = null,
    val error: String? = null
)

@Serializable
data class CreateTaskRequest(
    val title: String,
    val description: String,
    val category: String,
    val priority: String,
    val dueDate: String? = null,
    val dueTime: String? = null,
    val location: String? = null
)

@Serializable
data class CreateMemoryRequest(
    val key: String,
    val content: String,
    val category: String
)

@Serializable
data class ChatRequest(
    val message: String,
    val uiLanguage: String
)

@Serializable
data class ApplyChatActionRequest(
    val chatMessageId: String,
    val actionIndex: Int
)

@Serializable
data class ErrorPayload(
    val error: String? = null,
    val raw: JsonObject? = null
)
