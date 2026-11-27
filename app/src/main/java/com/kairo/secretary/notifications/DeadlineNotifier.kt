package com.kairo.secretary.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.CalendarContract
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.kairo.secretary.MainActivity
import com.kairo.secretary.data.SecretaryTask
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

object DeadlineNotifier {
    const val CHANNEL_ID = "kairo_proactive_alerts"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager?.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Kairo Secretary Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Proactive reminders for urgent deadlines, schedule changes, and critical messages."
                }
                manager?.createNotificationChannel(channel)
            }
        }
    }

    fun postAlert(context: Context, id: Int, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        ensureChannel(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(id, notification)
    }

    fun isNotificationListenerEnabled(context: Context): Boolean {
        val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
        return context.packageName in enabledPackages
    }

    fun openNotificationListenerSettings(context: Context) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun openAddToCalendarIntent(context: Context, task: SecretaryTask) {
        val intent = Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, task.title)
            val details = buildString {
                if (task.description.isNotBlank()) append(task.description)
                if (!task.sourceSender.isNullOrBlank()) {
                    if (isNotEmpty()) append("\n")
                    append("Source: ${task.sourceApp} (${task.sourceSender})")
                }
            }
            if (details.isNotBlank()) putExtra(CalendarContract.Events.DESCRIPTION, details)
            if (!task.location.isNullOrBlank()) putExtra(CalendarContract.Events.EVENT_LOCATION, task.location)

            val dateStr = task.dueDate
            if (!dateStr.isNullOrBlank()) {
                runCatching {
                    val date = LocalDate.parse(dateStr)
                    val timeStr = task.dueTime
                    if (!timeStr.isNullOrBlank() && Regex("""^\d{2}:\d{2}$""").matches(timeStr)) {
                        val time = LocalTime.parse(timeStr)
                        val startMillis = LocalDateTime.of(date, time)
                            .atZone(ZoneId.systemDefault())
                            .toInstant()
                            .toEpochMilli()
                        putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
                        putExtra(CalendarContract.EXTRA_EVENT_END_TIME, startMillis + 60 * 60 * 1000L)
                    } else {
                        val startMillis = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                        putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
                        putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
                    }
                }
            }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
