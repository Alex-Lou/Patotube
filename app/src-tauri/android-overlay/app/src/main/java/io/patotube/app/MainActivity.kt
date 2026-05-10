package io.patotube.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import org.json.JSONObject

class MainActivity : TauriActivity() {
  /** Cached so `onNewIntent` can poke the JS layer once a fresh
   *  intent has been parked in the PatoMobileBridge companion. */
  private var liveWebView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    intent?.let { capturePendingIntent(it) }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    capturePendingIntent(intent)
    pokeJsIntentListener()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    liveWebView = webView
    // Expose `window.PatoMobile.*` to the React app — see
    // PatoMobileBridge.kt for the full method surface.
    webView.addJavascriptInterface(PatoMobileBridge(this, webView), "PatoMobile")
  }

  /**
   * Translate an incoming Android intent (share sheet target,
   * "Open with → Patotube" chooser, browser-side
   * `patotube://download?url=…`) into a JSON payload that the
   * React side reads via `window.PatoMobile.consumePendingIntent()`.
   *
   * We deliberately don't try to round-trip through the Tauri
   * deep-link plugin: that plugin only registers URL schemes on
   * desktop, so on Android the patotube:// intent never reaches
   * its event channel. The PatoMobile bridge is the one source of
   * truth on this platform.
   */
  private fun capturePendingIntent(intent: Intent) {
    val payload = synthesizePendingIntent(intent) ?: return
    PatoMobileBridge.pendingIntent = payload.toString()
  }

  private fun synthesizePendingIntent(intent: Intent): JSONObject? {
    return when (intent.action) {
      Intent.ACTION_SEND -> {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return null
        val url = extractFirstUrl(text) ?: return null
        JSONObject().apply {
          put("kind", "download")
          put("url", url)
        }
      }
      Intent.ACTION_VIEW -> {
        val data = intent.data ?: return null
        when (data.scheme) {
          "patotube" -> parsePatotubeDeepLink(data)
          "file", "content" -> {
            val path = resolveFilePath(data) ?: return null
            JSONObject().apply {
              put("kind", "open-file")
              put("path", path)
            }
          }
          else -> null
        }
      }
      else -> null
    }
  }

  private fun parsePatotubeDeepLink(uri: Uri): JSONObject? {
    // patotube://download?url=…   → enqueue
    // patotube://open-file?path=… → embedded player
    // The action sits in the host position of the URI.
    val action = uri.host ?: return null
    return when (action) {
      "download" -> {
        val url = uri.getQueryParameter("url") ?: return null
        JSONObject().apply {
          put("kind", "download")
          put("url", url)
        }
      }
      "open-file" -> {
        val path = uri.getQueryParameter("path") ?: return null
        JSONObject().apply {
          put("kind", "open-file")
          put("path", path)
        }
      }
      else -> null
    }
  }

  private fun extractFirstUrl(text: String): String? {
    // Naive but bullet-proof: every share-target payload we care
    // about (YouTube / SoundCloud / Bandcamp / Audiomack) ships
    // either a bare URL or a "Check this: <URL>" string. First
    // http(s) match is always the right one.
    val regex = Regex("https?://\\S+")
    return regex.find(text)?.value
  }

  /**
   * Resolve a `content://` or `file://` URI back to an absolute
   * file path. Returns null if the URI isn't backed by a real file
   * (some content providers expose streams without a `_data`
   * column).
   */
  private fun resolveFilePath(uri: Uri): String? {
    if (uri.scheme == "file") return uri.path
    if (uri.scheme != "content") return null
    contentResolver.query(uri, arrayOf("_data"), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val idx = cursor.getColumnIndex("_data")
        if (idx >= 0) {
          val path = cursor.getString(idx)
          if (!path.isNullOrEmpty()) return path
        }
      }
    }
    return null
  }

  /** On warm start the WebView already exists, so we can ping the
   *  JS listener immediately. Cold start is handled by App.tsx
   *  calling `consumePendingIntent` on mount. */
  private fun pokeJsIntentListener() {
    val wv = liveWebView ?: return
    wv.post {
      wv.evaluateJavascript(
        "window.__patotubeOnIntent && window.__patotubeOnIntent();",
        null,
      )
    }
  }
}
