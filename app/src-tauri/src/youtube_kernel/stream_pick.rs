#![allow(dead_code)]

// Picks one stream out of YouTube's `formats` / `adaptiveFormats`
// arrays. Returns a `PickedFormat` with either a plain CDN URL or
// the `signatureCipher` blob — the caller is responsible for
// running ciphered formats through `sigcipher::Unlocker` before
// streaming.

use super::types::{Format, StreamingData};

#[derive(Debug, Clone)]
pub struct PickedFormat {
    /// Plain CDN URL, if the YouTube client served a non-ciphered
    /// format. Streamable as-is (modulo n-parameter throttling).
    pub direct_url: Option<String>,
    /// `signatureCipher` query-string blob (`s=…&sp=…&url=…`), if
    /// the YouTube client served a ciphered format instead. Pass
    /// to `sigcipher::Unlocker::unlock_url` to produce a
    /// streamable URL.
    pub signature_cipher: Option<String>,
    /// Declared content-length, when YouTube provides it. Used to
    /// compute progress percentages.
    pub content_length: Option<u64>,
    /// File extension we'll save under: "mp4", "m4a", "webm".
    pub extension: &'static str,
}

impl PickedFormat {
    /// Construct a "always succeeds" instance from a Format. Public
    /// for tests; production code should go through `pick_video` /
    /// `pick_audio`.
    fn from_format(f: &Format, extension: &'static str) -> Self {
        Self {
            direct_url: f.url.clone(),
            signature_cipher: f.signature_cipher.clone(),
            content_length: f
                .content_length
                .as_deref()
                .and_then(|s| s.parse::<u64>().ok()),
            extension,
        }
    }
}

/// Pick the best playable combined-MP4 stream within the user's
/// quality cap. We deliberately walk three filters:
///   1. mp4 + height ≤ cap   (preferred — universal player support)
///   2. any container + height ≤ cap   (fallback)
///   3. any url-bearing OR cipher-bearing format   (last resort)
///
/// Quality strings are kept in lock-step with the frontend's
/// `VIDEO_QUALITIES` enum.
pub fn pick_video(
    streaming: &StreamingData,
    quality: &str,
) -> Result<PickedFormat, String> {
    let height_cap: u32 = match quality {
        "high" => 1080,
        "medium" => 720,
        "low" => 480,
        _ => 4320,
    };

    let chosen = streaming
        .formats
        .iter()
        .filter(|f| has_streamable_source(f))
        .filter(|f| f.height <= height_cap)
        .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.contains("mp4")))
        .max_by_key(|f| f.height)
        .or_else(|| {
            streaming
                .formats
                .iter()
                .filter(|f| has_streamable_source(f))
                .filter(|f| f.height <= height_cap)
                .max_by_key(|f| f.height)
        })
        .or_else(|| streaming.formats.iter().find(|f| has_streamable_source(f)))
        .ok_or_else(|| "No compatible MP4 stream available.".to_string())?;

    Ok(PickedFormat::from_format(chosen, "mp4"))
}

/// Pick the best audio-only stream. We prefer m4a (mp4-container AAC)
/// because every Android music app reads it without quirks; webm/opus
/// is the fallback for videos where YouTube only offers Opus
/// adaptive audio.
pub fn pick_audio(streaming: &StreamingData) -> Result<PickedFormat, String> {
    let chosen = streaming
        .adaptive_formats
        .iter()
        .filter(|f| has_streamable_source(f))
        .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.starts_with("audio/mp4")))
        .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        .or_else(|| {
            streaming
                .adaptive_formats
                .iter()
                .filter(|f| has_streamable_source(f))
                .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.starts_with("audio/")))
                .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        })
        .ok_or_else(|| "No audio-only stream available for this video.".to_string())?;

    let ext = chosen
        .mime_type
        .as_deref()
        .map(|m| if m.contains("webm") { "webm" } else { "m4a" })
        .unwrap_or("m4a");
    Ok(PickedFormat::from_format(chosen, ext))
}

/// A format is streamable if it has either a direct URL or an
/// encoded `signatureCipher` blob. Without one of the two there's
/// nothing for the downloader to consume.
fn has_streamable_source(f: &Format) -> bool {
    f.url.is_some() || f.signature_cipher.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fmt(
        url: Option<&str>,
        cipher: Option<&str>,
        mime: &str,
        height: u32,
        bitrate: Option<u64>,
    ) -> Format {
        Format {
            url: url.map(String::from),
            signature_cipher: cipher.map(String::from),
            mime_type: Some(mime.to_string()),
            height,
            content_length: Some("1234".into()),
            average_bitrate: bitrate,
            audio_quality: None,
        }
    }

    #[test]
    fn pick_video_picks_direct_url_first_within_cap() {
        let sd = StreamingData {
            formats: vec![
                fmt(Some("low.mp4"), None, "video/mp4", 360, None),
                fmt(Some("high.mp4"), None, "video/mp4", 1080, None),
                fmt(Some("4k.mp4"), None, "video/mp4", 2160, None),
            ],
            adaptive_formats: vec![],
        };
        let chosen = pick_video(&sd, "high").unwrap();
        assert_eq!(chosen.direct_url.as_deref(), Some("high.mp4"));
        assert_eq!(chosen.extension, "mp4");
        assert_eq!(chosen.content_length, Some(1234));
    }

    #[test]
    fn pick_video_falls_back_to_signature_cipher() {
        let sd = StreamingData {
            formats: vec![fmt(None, Some("s=ABC&url=foo"), "video/mp4", 720, None)],
            adaptive_formats: vec![],
        };
        let chosen = pick_video(&sd, "best").unwrap();
        assert!(chosen.direct_url.is_none());
        assert_eq!(chosen.signature_cipher.as_deref(), Some("s=ABC&url=foo"));
    }

    #[test]
    fn pick_video_errors_when_no_formats() {
        let sd = StreamingData {
            formats: vec![],
            adaptive_formats: vec![],
        };
        let err = pick_video(&sd, "best").unwrap_err();
        assert!(err.contains("No compatible MP4"));
    }

    #[test]
    fn pick_audio_prefers_audio_mp4_by_bitrate() {
        let sd = StreamingData {
            formats: vec![],
            adaptive_formats: vec![
                fmt(Some("low.m4a"), None, "audio/mp4", 0, Some(96)),
                fmt(Some("high.m4a"), None, "audio/mp4", 0, Some(256)),
                fmt(Some("opus.webm"), None, "audio/webm", 0, Some(160)),
            ],
        };
        let chosen = pick_audio(&sd).unwrap();
        assert_eq!(chosen.direct_url.as_deref(), Some("high.m4a"));
        assert_eq!(chosen.extension, "m4a");
    }

    #[test]
    fn pick_audio_falls_back_to_webm_when_no_m4a() {
        let sd = StreamingData {
            formats: vec![],
            adaptive_formats: vec![fmt(
                Some("opus.webm"),
                None,
                "audio/webm",
                0,
                Some(160),
            )],
        };
        let chosen = pick_audio(&sd).unwrap();
        assert_eq!(chosen.direct_url.as_deref(), Some("opus.webm"));
        assert_eq!(chosen.extension, "webm");
    }

    #[test]
    fn pick_audio_passes_through_signature_cipher() {
        let sd = StreamingData {
            formats: vec![],
            adaptive_formats: vec![fmt(
                None,
                Some("s=XYZ&url=encoded"),
                "audio/mp4",
                0,
                Some(128),
            )],
        };
        let chosen = pick_audio(&sd).unwrap();
        assert!(chosen.direct_url.is_none());
        assert_eq!(chosen.signature_cipher.as_deref(), Some("s=XYZ&url=encoded"));
        assert_eq!(chosen.extension, "m4a");
    }
}
