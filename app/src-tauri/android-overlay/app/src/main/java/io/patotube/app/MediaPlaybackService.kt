// Foreground service for native background-audio playback. Takes a
// signed googlevideo URL + matching User-Agent from JS and feeds it
// to a MediaPlayer that keeps playing when the WebView is suspended
// (screen lock, "Listen in background" handoff).
//
// The notification surfaces play/pause/stop AND two "where do you
// want to go back?" actions:
//   - App      → bring MainActivity to the front + park a JSON
//                pending-intent so JS re-opens SearchPlayerDialog
//                at the exact position the audio was at.
//   - Floating → same, but opens FloatingPlayer instead.
//
// Action protocol:
//   - default              : keep foreground notification alive.
//   - ACTION_BG_START      : take over with native MediaPlayer.
//   - ACTION_BG_STOP       : release the native player.
//   - ACTION_BG_TOGGLE     : pause if playing, resume if paused.
//   - ACTION_BG_STOP_USER  : user tapped Stop — release + tear down.
//   - ACTION_BG_TO_APP     : tear down audio, bring app foreground,
//                            tell JS to resume in the dialog.
//   - ACTION_BG_TO_FLOAT   : same, but resume in the floating player.
//   - ACTION_STOP_IF_IDLE  : tear down service iff no bgPlayer.

package io.patotube.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import org.json.JSONObject

class MediaPlaybackService : Service() {
  companion object {
    private const val TAG = "PatoMediaSvc"
    private const val CHANNEL_ID = "patotube_media_playback"
    private const val NOTIF_ID = 1001

    /** Weak ref to the live service instance so MainActivity (run from
     *  the notif's PendingIntent) can query the bgPlayer's *current*
     *  position at the moment of the click — not the stale value
     *  baked into the PendingIntent extras 0-2 s earlier. Without
     *  this the user sees the player rewind 1-2 s on every resume. */
    @Volatile
    private var instance: MediaPlaybackService? = null

    /** Returns the live MediaPlayer position in ms, or null if the
     *  service or player isn't alive. */
    fun currentPositionMs(): Int? {
      val svc = instance ?: return null
      val mp = svc.bgPlayer ?: return null
      return try {
        mp.currentPosition
      } catch (_: Throwable) {
        null
      }
    }

    const val ACTION_BG_START = "io.patotube.app.BG_START"
    const val ACTION_BG_STOP = "io.patotube.app.BG_STOP"
    const val ACTION_BG_TOGGLE = "io.patotube.app.BG_TOGGLE"
    const val ACTION_BG_STOP_USER = "io.patotube.app.BG_STOP_USER"
    /** Carried as Intent.action when MainActivity is launched from the
     *  notification's "App" / "Floating" buttons. Handled there
     *  (synthesizePendingIntent) — not by the service — so we never
     *  hit the Android 14+ "Background Activity Start" restriction
     *  that crashes the app when a Service tries to startActivity()
     *  from the foreground notification button path. */
    const val ACTION_RESUME_DIALOG = "io.patotube.app.RESUME_DIALOG"
    const val ACTION_RESUME_FLOATING = "io.patotube.app.RESUME_FLOATING"
    const val ACTION_STOP_IF_IDLE = "io.patotube.app.STOP_IF_IDLE"

    fun start(context: Context) = sendIntent(context, null, null)

    fun stopIfIdle(context: Context) = sendIntent(context, ACTION_STOP_IF_IDLE, null)

    fun startBackgroundAudio(
      context: Context,
      url: String,
      ua: String,
      videoId: String,
      title: String,
      thumbnailUrl: String,
      positionMs: Int,
    ) {
      sendIntent(context, ACTION_BG_START, Bundleish(url, ua, videoId, title, thumbnailUrl, positionMs))
    }

    fun stopBackgroundAudio(context: Context) = sendIntent(context, ACTION_BG_STOP, null)

    private fun sendIntent(context: Context, action: String?, args: Bundleish?) {
      val intent = Intent(context, MediaPlaybackService::class.java)
      action?.let { intent.action = it }
      args?.let {
        intent.putExtra("url", it.url)
        intent.putExtra("ua", it.ua)
        intent.putExtra("videoId", it.videoId)
        intent.putExtra("title", it.title)
        intent.putExtra("thumbnailUrl", it.thumbnailUrl)
        intent.putExtra("position", it.positionMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    private data class Bundleish(
      val url: String,
      val ua: String,
      val videoId: String,
      val title: String,
      val thumbnailUrl: String,
      val positionMs: Int,
    )
  }

  private data class TrackInfo(
    val videoId: String,
    val title: String,
    val thumbnailUrl: String,
  )

  private var bgPlayer: MediaPlayer? = null
  private var mediaSession: MediaSessionCompat? = null
  private var currentTrack: TrackInfo? = null
  /** Decoded thumbnail bitmap shown in the notif + as artwork on the
   *  lock screen. Fetched off the main thread once per BG_START. */
  @Volatile private var artwork: Bitmap? = null
  /** URL of the artwork currently loaded into [artwork] — skip a
   *  refetch when handleBgStart fires twice with the same track. */
  @Volatile private var artworkUrl: String? = null
  @Volatile private var currentTitle: String = "Patotube"
  @Volatile private var isPlaying: Boolean = false

  /** Periodic notif rebuild while playing — keeps the "App" /
   *  "Floating" buttons' PendingIntent extras at most 2 s stale, so
   *  the user is never thrown back to a position they passed minutes
   *  ago. */
  private val mainHandler = Handler(Looper.getMainLooper())
  private val notifTick: Runnable = object : Runnable {
    override fun run() {
      if (isPlaying) {
        refreshNotification()
        mainHandler.postDelayed(this, 2000L)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    createNotificationChannel()
    mediaSession = MediaSessionCompat(this, "PatotubeBgAudio").apply {
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() = togglePlay(true)
        override fun onPause() = togglePlay(false)
        override fun onStop() {
          releaseBgPlayer()
          stopForegroundCompat()
          stopSelf()
        }
      })
      isActive = true
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_BG_START -> handleBgStart(intent)
      ACTION_BG_STOP -> handleBgStop()
      ACTION_BG_TOGGLE -> togglePlay(!isPlaying)
      ACTION_BG_STOP_USER -> {
        Log.d(TAG, "BG_STOP_USER: tearing down")
        releaseBgPlayer()
        stopForegroundCompat()
        stopSelf()
      }
      ACTION_STOP_IF_IDLE -> {
        if (bgPlayer == null) {
          Log.d(TAG, "STOP_IF_IDLE: idle, tearing down")
          stopSelf()
        } else {
          Log.d(TAG, "STOP_IF_IDLE: bgPlayer alive, staying up")
        }
      }
      else -> goForeground()
    }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    mainHandler.removeCallbacks(notifTick)
    releaseBgPlayer()
    mediaSession?.run {
      isActive = false
      release()
    }
    mediaSession = null
    if (instance === this) instance = null
    super.onDestroy()
  }

  // ---- background-audio takeover --------------------------------

  private fun handleBgStart(intent: Intent) {
    val url = intent.getStringExtra("url")
    if (url.isNullOrEmpty()) {
      Log.w(TAG, "BG_START: missing url")
      postJsError("missing url")
      return
    }
    val ua = intent.getStringExtra("ua") ?: ""
    val videoId = intent.getStringExtra("videoId") ?: ""
    val title = intent.getStringExtra("title") ?: "Patotube"
    val thumbnailUrl = intent.getStringExtra("thumbnailUrl") ?: ""
    val positionMs = intent.getIntExtra("position", 0)
    currentTitle = title
    currentTrack = TrackInfo(videoId, title, thumbnailUrl)
    goForeground()
    loadArtworkAsync(thumbnailUrl)
    Log.d(TAG, "BG_START title=$title pos=${positionMs}ms ua=${ua.take(40)}…")
    startBgPlayer(url, ua, positionMs)
  }

  /** Async fetch of the YouTube thumbnail so the notif and the lock
   *  screen show the cover instead of the generic media icon. Cheap
   *  bitmap (~30 KB), kept in memory for the service's lifetime. */
  private fun loadArtworkAsync(url: String) {
    if (url.isEmpty() || url == artworkUrl) return
    Thread({
      val bmp = try {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 5000
        conn.readTimeout = 5000
        conn.inputStream.use { BitmapFactory.decodeStream(it) }
      } catch (t: Throwable) {
        Log.w(TAG, "artwork fetch failed", t)
        null
      } ?: return@Thread
      mainHandler.post {
        artwork = bmp
        artworkUrl = url
        refreshNotification()
      }
    }, "patotube-artwork").start()
  }

  private fun handleBgStop() {
    releaseBgPlayer()
  }

  private fun togglePlay(shouldPlay: Boolean) {
    val mp = bgPlayer ?: return
    try {
      if (shouldPlay && !mp.isPlaying) mp.start()
      else if (!shouldPlay && mp.isPlaying) mp.pause()
    } catch (t: Throwable) {
      Log.e(TAG, "togglePlay failed", t)
      return
    }
    isPlaying = shouldPlay
    updatePlaybackState()
    refreshNotification()
    schedulePositionRefresh()
  }

  private fun schedulePositionRefresh() {
    mainHandler.removeCallbacks(notifTick)
    if (isPlaying) mainHandler.postDelayed(notifTick, 2000L)
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
        postJsError("setDataSource: ${t.javaClass.simpleName}: ${t.message ?: ""}")
        return@apply
      }
      setOnPreparedListener { mp ->
        try {
          if (positionMs > 0) {
            // SEEK_CLOSEST (API 26+) lands on the requested frame —
            // plain seekTo() snaps to the closest preceding keyframe,
            // which on H.264 / AAC drops the user back 0.5-2 s. That
            // 1-second rewind on every Listen-in-background handoff
            // was the bug the user spotted.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              mp.seekTo(positionMs.toLong(), MediaPlayer.SEEK_CLOSEST)
            } else {
              mp.seekTo(positionMs)
            }
          }
          mp.start()
          this@MediaPlaybackService.isPlaying = true
          updatePlaybackState()
          refreshNotification()
          schedulePositionRefresh()
          Log.d(TAG, "BG player started at ${positionMs}ms")
        } catch (t: Throwable) {
          Log.e(TAG, "start failed", t)
          postJsError("start: ${t.javaClass.simpleName}: ${t.message ?: ""}")
        }
      }
      setOnErrorListener { _, what, extra ->
        Log.e(TAG, "MediaPlayer error what=$what extra=$extra")
        postJsError("MediaPlayer error what=$what extra=$extra")
        true
      }
      setOnCompletionListener {
        this@MediaPlaybackService.isPlaying = false
        updatePlaybackState()
        refreshNotification()
        releaseBgPlayer()
      }
      try {
        prepareAsync()
      } catch (t: Throwable) {
        Log.e(TAG, "prepareAsync failed", t)
        postJsError("prepareAsync: ${t.javaClass.simpleName}: ${t.message ?: ""}")
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
    isPlaying = false
    updatePlaybackState()
  }

  private fun postJsError(message: String) {
    val escaped = JSONObject.quote(message)
    MainActivity.postJs("window.__patotubeOnBgError && window.__patotubeOnBgError($escaped);")
  }

  // ---- notification + media session ------------------------------

  private fun goForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun refreshNotification() {
    val mgr = getSystemService(NotificationManager::class.java) ?: return
    mgr.notify(NOTIF_ID, buildNotification())
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun updatePlaybackState() {
    val session = mediaSession ?: return
    val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
    val pos = try { bgPlayer?.currentPosition?.toLong() ?: 0L } catch (_: Throwable) { 0L }
    session.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(
          PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_STOP,
        )
        .setState(state, pos, 1.0f)
        .build(),
    )
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

  private fun servicePendingIntent(action: String, reqCode: Int): PendingIntent {
    val intent = Intent(this, MediaPlaybackService::class.java).apply { this.action = action }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else PendingIntent.FLAG_UPDATE_CURRENT
    return PendingIntent.getService(this, reqCode, intent, flags)
  }

  /** PendingIntent.getActivity for the notif's App / Floating
   *  buttons. Carries the resume metadata + current bgPlayer position
   *  as extras — MainActivity reads them and parks a
   *  resume-player JSON intent for the React layer to consume.
   *  Going via getActivity (not getService → startActivity) sidesteps
   *  the Android 14+ Background Activity Start crash. */
  private fun resumeActivityPendingIntent(action: String, reqCode: Int): PendingIntent {
    val track = currentTrack
    val pos = try { bgPlayer?.currentPosition ?: 0 } catch (_: Throwable) { 0 }
    val intent = Intent(this, MainActivity::class.java).apply {
      this.action = action
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("videoId", track?.videoId ?: "")
      putExtra("title", track?.title ?: currentTitle)
      putExtra("thumbnailUrl", track?.thumbnailUrl ?: "")
      putExtra("positionMs", pos)
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else PendingIntent.FLAG_UPDATE_CURRENT
    return PendingIntent.getActivity(this, reqCode, intent, flags)
  }

  private fun buildNotification(): Notification {
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val contentIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

    val toggleIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    val toggleLabel = if (isPlaying) "Pause" else "Lecture"
    val toggleAction = NotificationCompat.Action.Builder(
      toggleIcon, toggleLabel, servicePendingIntent(ACTION_BG_TOGGLE, 1),
    ).build()
    val stopAction = NotificationCompat.Action.Builder(
      android.R.drawable.ic_menu_close_clear_cancel, "Arrêter",
      servicePendingIntent(ACTION_BG_STOP_USER, 2),
    ).build()
    val appAction = NotificationCompat.Action.Builder(
      android.R.drawable.ic_menu_view, "App",
      resumeActivityPendingIntent(ACTION_RESUME_DIALOG, 4),
    ).build()
    val floatAction = NotificationCompat.Action.Builder(
      android.R.drawable.ic_menu_gallery, "Flottant",
      resumeActivityPendingIntent(ACTION_RESUME_FLOATING, 5),
    ).build()

    // Compact view shows the first 3 actions Android picks — point at
    // Play/Pause + Stop for the lock-screen mini view; expanded view
    // gets all four.
    val style = MediaStyle()
      .setMediaSession(mediaSession?.sessionToken)
      .setShowActionsInCompactView(0, 1)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(currentTitle)
      .setContentText(if (isPlaying) "Lecture en cours" else "En pause")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setLargeIcon(artwork)
      .setContentIntent(contentIntent)
      .setDeleteIntent(servicePendingIntent(ACTION_BG_STOP_USER, 3))
      .addAction(toggleAction)
      .addAction(stopAction)
      .addAction(appAction)
      .addAction(floatAction)
      .setStyle(style)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      // setOngoing(false) on purpose, even while playing: keeps the
      // notif dismissible via the system X / swipe, which routes
      // through setDeleteIntent → ACTION_BG_STOP_USER → tear down.
      // With ongoing=true some OEM skins (Samsung One UI) silently
      // drop the notif WITHOUT calling deleteIntent, leaving the
      // service alive and audible.
      .setOngoing(false)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .build()
  }
}
