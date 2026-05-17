// Foreground service that keeps Patotube alive while a <video> or
// <audio> tag is playing AND can take over audio decoding natively
// (Android MediaPlayer) when the WebView is suspended — typically
// when the user locks the screen. Architecture mirrors what VLC /
// YouTube Music do: the UI shows the video, the service owns the
// actual audio session, the two hand-off based on activity
// visibility.
//
// Action protocol (sent via PatoMobileBridge → start(context, …)):
//   - default (no action) : just ensure the foreground notification
//     is up. WebView is doing the playback.
//   - ACTION_BG_START     : screen went off / app backgrounded.
//                           Take over with native MediaPlayer at
//                           the position the WebView left off.
//   - ACTION_BG_STOP      : screen came back. Release the native
//                           player; WebView resumes.

package io.patotube.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class MediaPlaybackService : Service() {
  companion object {
    private const val TAG = "PatoMediaSvc"
    private const val CHANNEL_ID = "patotube_media_playback"
    private const val NOTIF_ID = 1001

    const val ACTION_BG_START = "io.patotube.app.BG_START"
    const val ACTION_BG_STOP = "io.patotube.app.BG_STOP"

    fun start(context: Context) = sendIntent(context, null, null)

    fun stop(context: Context) {
      context.stopService(Intent(context, MediaPlaybackService::class.java))
    }

    fun startBackgroundAudio(
      context: Context,
      url: String,
      ua: String,
      title: String,
      positionMs: Int,
    ) {
      sendIntent(context, ACTION_BG_START, Bundleish(url, ua, title, positionMs))
    }

    fun stopBackgroundAudio(context: Context) = sendIntent(context, ACTION_BG_STOP, null)

    private fun sendIntent(context: Context, action: String?, args: Bundleish?) {
      val intent = Intent(context, MediaPlaybackService::class.java)
      action?.let { intent.action = it }
      args?.let {
        intent.putExtra("url", it.url)
        intent.putExtra("ua", it.ua)
        intent.putExtra("title", it.title)
        intent.putExtra("position", it.positionMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    private data class Bundleish(val url: String, val ua: String, val title: String, val positionMs: Int)
  }

  private var bgPlayer: MediaPlayer? = null
  @Volatile private var currentTitle: String = "Patotube"

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_BG_START -> handleBgStart(intent)
      ACTION_BG_STOP -> handleBgStop()
      else -> goForeground(currentTitle)
    }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    releaseBgPlayer()
    super.onDestroy()
  }

  // ---- background-audio takeover --------------------------------

  private fun handleBgStart(intent: Intent) {
    val url = intent.getStringExtra("url") ?: return
    val ua = intent.getStringExtra("ua") ?: ""
    val title = intent.getStringExtra("title") ?: "Patotube"
    val positionMs = intent.getIntExtra("position", 0)
    currentTitle = title
    goForeground(title)
    startBgPlayer(url, ua, positionMs)
  }

  private fun handleBgStop() {
    releaseBgPlayer()
    // Notification stays up: setMediaPlaying(false) is what tears
    // down the whole service. The WebView may still be playing
    // (visibility came back), so we don't stop foreground here.
  }

  private fun startBgPlayer(url: String, ua: String, positionMs: Int) {
    releaseBgPlayer()
    bgPlayer = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
      val headers = if (ua.isNotEmpty()) mapOf("User-Agent" to ua) else emptyMap()
      try {
        setDataSource(this@MediaPlaybackService, Uri.parse(url), headers)
      } catch (t: Throwable) {
        Log.e(TAG, "setDataSource failed", t)
        return@apply
      }
      setOnPreparedListener { mp ->
        try {
          if (positionMs > 0) mp.seekTo(positionMs)
          mp.start()
        } catch (t: Throwable) {
          Log.e(TAG, "start failed", t)
        }
      }
      setOnErrorListener { _, what, extra ->
        Log.e(TAG, "MediaPlayer error what=$what extra=$extra")
        // True swallows the error → no completion callback after
        true
      }
      setOnCompletionListener { releaseBgPlayer() }
      try {
        prepareAsync()
      } catch (t: Throwable) {
        Log.e(TAG, "prepareAsync failed", t)
      }
    }
  }

  private fun releaseBgPlayer() {
    bgPlayer?.apply {
      try {
        if (isPlaying) stop()
      } catch (_: Exception) { /* state is fine to ignore */ }
      try {
        release()
      } catch (_: Exception) { /* idem */ }
    }
    bgPlayer = null
  }

  // ---- foreground notification -----------------------------------

  private fun goForeground(title: String) {
    val notification = buildNotification(title)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

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

  private fun buildNotification(title: String): Notification {
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
      .setContentTitle(title)
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
