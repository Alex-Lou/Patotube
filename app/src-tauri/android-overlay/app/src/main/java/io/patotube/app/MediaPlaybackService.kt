// Foreground service that keeps Patotube alive while a <video> or
// <audio> tag is playing. THREE Android subsystems have to be told
// the app is actively producing audio, otherwise the WebView's
// media decoder is suspended as soon as the screen turns off:
//
//   1. foregroundServiceType="mediaPlayback" + persistent
//      notification → tells the OS not to kill the process.
//   2. MediaSession with STATE_PLAYING → tells AudioFlinger this
//      app is the active media player. Without this, focus is
//      handed to the next app that requests audio on lock.
//   3. AUDIOFOCUS_GAIN with USAGE_MEDIA → reserves the music stream.
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
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
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

  private var mediaSession: MediaSession? = null
  private var audioFocusRequest: AudioFocusRequest? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    setupMediaSession()
    requestAudioFocus()
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

  override fun onDestroy() {
    releaseAudioFocus()
    mediaSession?.apply {
      isActive = false
      release()
    }
    mediaSession = null
    super.onDestroy()
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

  /**
   * Active MediaSession is what tells Android's AudioFlinger "this
   * app is the current media controller — don't release its audio
   * focus when the screen turns off". Without this, the foreground
   * service alone isn't enough; the WebView's audio is paused as
   * soon as the activity becomes invisible.
   */
  private fun setupMediaSession() {
    mediaSession = MediaSession(this, "Patotube").apply {
      setFlags(
        MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or
          MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS,
      )
      setPlaybackState(
        PlaybackState.Builder()
          .setActions(
            PlaybackState.ACTION_PLAY or
              PlaybackState.ACTION_PAUSE or
              PlaybackState.ACTION_STOP,
          )
          .setState(PlaybackState.STATE_PLAYING, 0L, 1f)
          .build(),
      )
      setMetadata(
        MediaMetadata.Builder()
          .putString(MediaMetadata.METADATA_KEY_TITLE, "Patotube")
          .putString(MediaMetadata.METADATA_KEY_ARTIST, "En cours de lecture")
          .build(),
      )
      isActive = true
    }
  }

  private fun requestAudioFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()
      audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener { /* WebView handles its own focus internally */ }
        .build()
      audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(
        null,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN,
      )
    }
  }

  private fun releaseAudioFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
    audioFocusRequest = null
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
