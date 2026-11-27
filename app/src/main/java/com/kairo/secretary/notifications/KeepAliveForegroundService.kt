package com.kairo.secretary.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.kairo.secretary.MainActivity

/**
 * Optional foreground status guard initiated strictly from the foreground UI.
 * Displays an ongoing low-priority status notification so OEM systems like vivo OriginOS
 * are less likely to freeze background network sync while the screen is locked.
 */
class KeepAliveForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "kairo_background_guard"
        private const val NOTIFICATION_ID = 4109

        fun start(context: Context): Boolean {
            return runCatching {
                val intent = Intent(context, KeepAliveForegroundService::class.java)
                ContextCompat.startForegroundService(context, intent)
                true
            }.getOrDefault(false)
        }

        fun stop(context: Context) {
            runCatching {
                context.stopService(Intent(context, KeepAliveForegroundService::class.java))
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        val openIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Kairo 私人秘书后台监听保护中")
            .setContentText("正在保持微信 / WhatsApp 通知监听与离线队列同步")
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        DeadlineNotifier.requestListenerRebind(applicationContext)
        return START_STICKY
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        stopSelf(startId)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager?.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Kairo Background Sync Guard",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Keeps Kairo notification listener sync resilient on OEM devices."
                    setShowBadge(false)
                }
                manager?.createNotificationChannel(channel)
            }
        }
    }
}
