// Bit-perfect "strip the video track" for Android audio downloads:
// copies the AAC samples of a combined MP4 into an audio-only M4A with
// MediaExtractor + MediaMuxer. No re-encoding, so no quality loss.
// Called on a worker thread by PatoMobileBridge.remuxAudioOnly.

package io.patotube.app

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

object AudioRemuxer {
    /** Samples are copied through this buffer when the track does not
     *  declare KEY_MAX_INPUT_SIZE. AAC frames are a few KB. */
    private const val DEFAULT_BUFFER_BYTES = 1 shl 20

    /** Throws on any failure; a partial `dstPath` is deleted first. */
    fun remux(srcPath: String, dstPath: String) {
        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        try {
            extractor.setDataSource(srcPath)
            val audioTrack = (0 until extractor.trackCount).firstOrNull { i ->
                extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: throw IllegalStateException("no audio track in $srcPath")

            val format = extractor.getTrackFormat(audioTrack)
            extractor.selectTrack(audioTrack)

            File(dstPath).delete()
            val out = MediaMuxer(dstPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            muxer = out
            val outTrack = out.addTrack(format)
            out.start()

            val bufferSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                maxOf(format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE), DEFAULT_BUFFER_BYTES)
            } else {
                DEFAULT_BUFFER_BYTES
            }
            val buffer = ByteBuffer.allocate(bufferSize)
            val info = MediaCodec.BufferInfo()
            while (true) {
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0) break
                val keyFrame = extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0
                info.set(0, size, extractor.sampleTime, if (keyFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                out.writeSampleData(outTrack, buffer, info)
                extractor.advance()
            }
            out.stop()
        } catch (t: Throwable) {
            try {
                muxer?.release()
            } catch (_: Throwable) { /* already broken */ }
            muxer = null
            File(dstPath).delete()
            throw t
        } finally {
            try {
                muxer?.release()
            } catch (_: Throwable) { /* released above on failure */ }
            extractor.release()
        }
    }
}
