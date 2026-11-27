package com.kairo.secretary.data

import kotlinx.serialization.Serializable

/**
 * Shared Kotlin DTOs matching /src/types/secretary.ts and the Express backend API.
 * Ready for Retrofit / Ktor + Room local persistence in Android Studio.
 */
@Serializable
data class IngestResponse(
    val message: IngestedMessageDto,
    val createdTasks: List<SecretaryTaskDto> = emptyList(),
    val detectedChanges: List<ScheduleChangeAlertDto> = emptyList()
)

@Serializable
data class IngestedMessageDto(
    val id: String,
    val source: String,
    val sender: String,
    val chatTitle: String? = null,
    val redactedText: String,
    val receivedAt: String,
    val detectedLanguages: List<String>,
    val summary: String,
    val importance: String,
    val importanceReason: String
)

@Serializable
data class SecretaryTaskDto(
    val id: String,
    val title: String,
    val description: String,
    val category: String,
    val status: String,
    val priority: String,
    val dueDate: String? = null,
    val dueTime: String? = null,
    val location: String? = null,
    val sourceMessageId: String? = null
)

@Serializable
data class ScheduleChangeAlertDto(
    val id: String,
    val title: String,
    val changeType: String,
    val summary: String,
    val previousValue: String,
    val newValue: String,
    val status: String
)
