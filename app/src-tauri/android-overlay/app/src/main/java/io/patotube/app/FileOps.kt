// File / intent helpers for the JS bridge. Stateless object — every
// method takes the Context (and authority for FileProvider) it needs
// from the caller.

package io.patotube.app

import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.util.Base64
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File

object FileOps {
    private const val TAG = "PatotubeFileOps"

    /** Best-effort delete. True if the file is gone after the call. */
    fun deleteFile(path: String): Boolean {
        return try {
            val f = File(path)
            !f.exists() || f.delete()
        } catch (e: Exception) {
            Log.w(TAG, "deleteFile($path) failed", e)
            false
        }
    }

    /** Atomic-ish rename. Deletes any existing file at `dstPath`
     *  first so renaming over the destination succeeds. Returns
     *  true if the source ended up at the destination. */
    fun renameFile(srcPath: String, dstPath: String): Boolean {
        return try {
            val src = File(srcPath)
            val dst = File(dstPath)
            if (!src.exists()) return false
            if (dst.exists() && !dst.delete()) {
                Log.w(TAG, "renameFile: cannot delete pre-existing $dstPath")
                return false
            }
            src.renameTo(dst)
        } catch (e: Exception) {
            Log.w(TAG, "renameFile($srcPath -> $dstPath) failed", e)
            false
        }
    }

    /** Trigger MediaScanner so the file shows up in Files / Music /
     *  Gallery apps right away without waiting for the periodic scan. */
    fun scanFile(context: Context, path: String) {
        try {
            MediaScannerConnection.scanFile(context, arrayOf(path), null) { p, uri ->
                Log.i(TAG, "scanned $p -> $uri")
            }
        } catch (e: Exception) {
            Log.e(TAG, "scanFile failed", e)
        }
    }

    /** Open the file with the system's default app for that MIME
     *  type. Uses FileProvider to dodge FileUriExposedException on
     *  Android 7+. */
    fun openFile(context: Context, authority: String, path: String): Boolean {
        return try {
            val file = File(path)
            if (!file.exists()) {
                Log.w(TAG, "openFile: $path does not exist")
                return false
            }
            val uri = FileProvider.getUriForFile(context, authority, file)
            val mime = context.contentResolver.getType(uri)
                ?: guessMimeFromName(path)
                ?: "*/*"
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "openFile failed", e)
            false
        }
    }

    /** Open the public Downloads folder via the system Documents UI.
     *  Falls back to ACTION_OPEN_DOCUMENT_TREE if the direct route
     *  isn't available. */
    fun openDownloadsFolder(context: Context): Boolean {
        // Modern Documents UI route — works on Android 9+.
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    Uri.parse(
                        "content://com.android.externalstorage.documents/document/primary%3ADownload"
                    ),
                    "vnd.android.document/directory"
                )
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return true
        } catch (_: Exception) {
            // fall through
        }
        return try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "openDownloadsFolder failed", e)
            false
        }
    }

    /** Share a file through the system share sheet. Constructs an
     *  ACTION_SEND with EXTRA_STREAM pointing at the FileProvider
     *  URI for `path`. Wraps in a chooser so the user picks the
     *  target app (Telegram / Drive / Bluetooth / …). */
    fun shareFile(context: Context, authority: String, path: String): Boolean {
        return try {
            val file = File(path)
            if (!file.exists()) {
                Log.w(TAG, "shareFile: $path does not exist")
                return false
            }
            val uri = FileProvider.getUriForFile(context, authority, file)
            val mime = context.contentResolver.getType(uri)
                ?: guessMimeFromName(path)
                ?: "*/*"
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TITLE, file.name)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(send, null).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
            true
        } catch (e: Exception) {
            Log.e(TAG, "shareFile failed", e)
            false
        }
    }

    /** Slurp a file into a base64 string. Used by the embedded
     *  HTML5 player as a more reliable alternative to Tauri's
     *  asset:// protocol on Android (which silently fails for
     *  arbitrary paths). Returns null on any IO error. */
    fun readFileBase64(path: String): String? {
        return try {
            val bytes = File(path).readBytes()
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.w(TAG, "readFileBase64 failed for $path", e)
            null
        }
    }

    private fun guessMimeFromName(name: String): String? {
        val lower = name.lowercase()
        return when {
            lower.endsWith(".mp4") -> "video/mp4"
            lower.endsWith(".m4a") -> "audio/mp4"
            lower.endsWith(".mp3") -> "audio/mpeg"
            lower.endsWith(".webm") -> "video/webm"
            lower.endsWith(".opus") -> "audio/opus"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            else -> null
        }
    }
}
