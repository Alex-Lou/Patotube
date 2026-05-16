// Slim @JavascriptInterface dispatcher. Every method here is
// reachable from the WebView at `window.PatoMobile.<method>(...)`;
// the actual logic lives in dedicated objects:
//
//   - File ops (open / scan / delete / rename / open Downloads)
//     → FileOps.kt
//   - Audio remux (MediaExtractor + MediaMuxer)
//     → AudioRemuxer.kt
//
// Wired up in MainActivity.onWebViewCreate().
//
// FFmpeg-style methods are async (`remuxAudioOnly`) because the
// Kotlin side runs the work on a worker thread and reports back via
// a global JS callback. Contract:
//   1. JS calls the method with a numeric `callbackId`.
//   2. Bridge spawns a worker Thread.
//   3. On completion, a JSON payload is marshalled and
//      `window.__patotubeFFmpegCallback(callbackId, payload)` is
//      invoked via webView.evaluateJavascript on the UI thread.
//
// (Callback name kept for historical reasons even though we no
// longer use ffmpeg — renaming would force a coordinated bridge
// update across Rust + TS + Kotlin without a real benefit.)

package io.patotube.app

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class PatoMobileBridge(
    private val context: Context,
    private val webView: WebView,
) {
    private val TAG = "PatoMobileBridge"
    private val authority = "${context.packageName}.fileprovider"

    companion object {
        /** Set by MainActivity.capturePendingIntent when an Android
         *  intent (share-target SEND, "Open with → Patotube" VIEW,
         *  or `patotube://` deep-link from a mobile browser) needs
         *  to be forwarded to JS. The React side reads it once via
         *  `consumePendingIntent` then it's cleared.
         *
         *  JSON shape: `{"kind":"download","url":"…"}` or
         *  `{"kind":"open-file","path":"…"}`. */
        @Volatile
        var pendingIntent: String? = null

        /** Tracked from JS via `setMediaPlaying(true/false)`. Read
         *  by MainActivity.onUserLeaveHint to decide whether to
         *  slip into Picture-in-Picture when the user backgrounds
         *  the app. */
        @Volatile
        var isMediaPlaying: Boolean = false
    }

    /** Read-and-clear access to the cross-thread pending intent.
     *  Returns null when there's nothing pending. The React side
     *  calls this on mount + on every visibilitychange to drain
     *  the queue. */
    @JavascriptInterface
    fun consumePendingIntent(): String? {
        val current = pendingIntent
        pendingIntent = null
        return current
    }

    /** Called by JS on every `<video>` play/pause/ended event. Lets
     *  the Kotlin side know whether to keep the WebView alive in
     *  background and whether to enter PiP on home-press. */
    @JavascriptInterface
    fun setMediaPlaying(playing: Boolean) {
        isMediaPlaying = playing
    }

    @JavascriptInterface
    fun scanFile(path: String) = FileOps.scanFile(context, path)

    @JavascriptInterface
    fun openFile(path: String): Boolean = FileOps.openFile(context, authority, path)

    @JavascriptInterface
    fun openDownloadsFolder(): Boolean = FileOps.openDownloadsFolder(context)

    @JavascriptInterface
    fun deleteFile(path: String): Boolean = FileOps.deleteFile(path)

    @JavascriptInterface
    fun renameFile(srcPath: String, dstPath: String): Boolean =
        FileOps.renameFile(srcPath, dstPath)

    @JavascriptInterface
    fun shareFile(path: String): Boolean = FileOps.shareFile(context, authority, path)

    /** Read a file's bytes into a base64 string for the embedded
     *  HTML5 player. The Tauri asset:// protocol works fine on
     *  desktop but tends to silently fail on Android WebView for
     *  arbitrary paths, so we sidestep it. Caller turns the string
     *  into a Blob URL.
     *
     *  Returns null on any read error (file missing, permission
     *  denied, …) so JS can surface a clean error toast. */
    @JavascriptInterface
    fun readFileBase64(path: String): String? = FileOps.readFileBase64(path)

    /** Strip the video track from `srcPath`, write the audio-only
     *  result to `dstPath`. See file header for the callback
     *  contract. Bit-perfect — AAC samples are copied without
     *  re-encoding. */
    @JavascriptInterface
    fun remuxAudioOnly(srcPath: String, dstPath: String, callbackId: Int) {
        Thread({
            val errorMsg = try {
                AudioRemuxer.remux(srcPath, dstPath)
                ""
            } catch (t: Throwable) {
                Log.e(TAG, "remuxAudioOnly failed", t)
                "${t.javaClass.simpleName}: ${t.message ?: "(no message)"}"
            }
            postCallback(callbackId, errorMsg)
        }, "patotube-remux-$callbackId").start()
    }

    private fun postCallback(callbackId: Int, errorMsg: String) {
        webView.post {
            val payload = JSONObject().apply { put("error", errorMsg) }.toString()
            webView.evaluateJavascript(
                "window.__patotubeFFmpegCallback && window.__patotubeFFmpegCallback($callbackId, $payload);",
                null,
            )
        }
    }
}
