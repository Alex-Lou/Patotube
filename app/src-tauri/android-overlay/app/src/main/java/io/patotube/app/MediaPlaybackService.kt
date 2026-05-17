// Foreground service that keeps Patotube alive while a <video> or
// <audio> tag is playing. The persistent notification + the
// foregroundServiceType="mediaPlayback" declaration in the manifest
// are what tell Android not to kill the process when the app is
// backgrounded.
//
// We DO NOT request AudioFocus here — doing so would steal focus
// from the WebView's own audio player (AUDIOFOCUS_GAIN is exclusive)
// and the WebView would mute itself. The WebView keeps its own
// audio focus implicitly when it starts playing.
//
// Lifecycle:
//   - JS calls PatoMobile.setMediaPlaying(true) on 'play'
//     → bridge calls MediaPlaybackService.start()
//   - JS calls setMediaPlaying(false) on 'pause' / 'ended'
//     → bridge calls MediaPlaybackService.stop()

package io.patotube.app

import android.app.Notification
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

class MediaPlaybackService : Service() {
  companion object {
    private const val CHANNEL_ID = "patotube_media_playback"
    private const val NOTIF_ID = 1001

    fun start(context: Context) {
      val intent = Intent(context, MediaPlaybackService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, MediaPlaybackService::class.java))
    }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, notification)
    }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Patotube playback",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps audio + video playing when the app is in background."
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Patotube")
      .setContentText("Lecture en cours")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .build()
  }
}
