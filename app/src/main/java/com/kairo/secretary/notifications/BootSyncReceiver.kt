package com.kairo.secretary.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.kairo.secretary.data.PrefsStore

/**
 * Re-requests NotificationListenerService binding and resumes queued offline syncs after device reboot or APK update.
 */
class BootSyncReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            DeadlineNotifier.requestListenerRebind(context)
            val prefs = PrefsStore(context)
            if (prefs.getPendingSyncQueue().isNotEmpty()) {
                PendingMessageSyncWorker.schedule(context, immediate = true)
            }
        }
    }
}
