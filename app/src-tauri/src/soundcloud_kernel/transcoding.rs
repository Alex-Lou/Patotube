#![allow(dead_code)]

use super::types::{Track, Transcoding};

#[derive(Debug, Clone)]
pub struct PickedTranscoding {
    pub url: String,
    pub extension: &'static str,
    /// Stream URL points to an HLS media playlist (segments to concatenate)
    /// rather than a single progressive file.
    pub hls: bool,
}

/// Progressive MP3 first (one plain GET), then any progressive, then
/// plain HLS — which is all SoundCloud serves for most tracks now.
/// Only DRM-encrypted HLS is refused.
pub fn pick_transcoding(track: &Track) -> Result<PickedTranscoding, String> {
    let mp3s: Vec<&Transcoding> = track
        .media
        .transcodings
        .iter()
        .filter(|t| is_progressive(t))
        .filter(|t| is_mp3(t))
        .collect();

    let chosen_mp3 = mp3s
        .iter()
        .copied()
        .find(|t| t.quality.as_deref().is_some_and(|q| q.eq_ignore_ascii_case("hq")))
        .or_else(|| mp3s.first().copied());

    if let Some(t) = chosen_mp3 {
        return Ok(PickedTranscoding {
            url: t.url.clone(),
            extension: "mp3",
            hls: false,
        });
    }

    if let Some(any) = track.media.transcodings.iter().find(|t| is_progressive(t)) {
        return Ok(PickedTranscoding {
            url: any.url.clone(),
            extension: extension_from_mime(&any.format.mime_type),
            hls: false,
        });
    }

    let best_hls = track
        .media
        .transcodings
        .iter()
        .filter(|t| is_plain_hls(t))
        .max_by_key(|t| hls_rank(t));
    if let Some(t) = best_hls {
        return Ok(PickedTranscoding {
            url: t.url.clone(),
            extension: extension_from_mime(&t.format.mime_type),
            hls: true,
        });
    }

    if track
        .media
        .transcodings
        .iter()
        .any(|t| t.format.protocol.to_ascii_lowercase().contains("encrypted"))
    {
        return Err("SoundCloud track is DRM-encrypted (encrypted HLS)".into());
    }
    Err("SoundCloud offered no downloadable audio format for this track".into())
}

/// Unencrypted HLS carrying audio segments. `audio/mpegurl` is the
/// adaptive master playlist (abr_*) — skipped, its variants are listed
/// individually anyway.
fn is_plain_hls(t: &Transcoding) -> bool {
    t.format.protocol.eq_ignore_ascii_case("hls")
        && !t.format.mime_type.to_ascii_lowercase().contains("mpegurl")
}

/// (quality tier, bitrate from preset e.g. `aac_160k` → 160).
fn hls_rank(t: &Transcoding) -> (u8, u32) {
    let tier = match t.quality.as_deref().map(str::to_ascii_lowercase).as_deref() {
        Some("hq") => 2,
        Some("sq") => 1,
        _ => 0,
    };
    let kbps = t
        .preset
        .as_deref()
        .and_then(|p| {
            let digits: String = p
                .rsplit('_')
                .next()?
                .chars()
                .take_while(char::is_ascii_digit)
                .collect();
            digits.parse().ok()
        })
        .unwrap_or(0);
    (tier, kbps)
}

fn is_mp3(t: &Transcoding) -> bool {
    t.preset.as_deref().is_some_and(|p| p.starts_with("mp3_"))
        || t.format.mime_type.contains("mpeg")
}

fn is_progressive(t: &Transcoding) -> bool {
    t.format.protocol.eq_ignore_ascii_case("progressive")
}

fn extension_from_mime(mime: &str) -> &'static str {
    let lower = mime.to_ascii_lowercase();
    if lower.contains("mpeg") {
        "mp3"
    } else if lower.contains("mp4") {
        "m4a"
    } else if lower.contains("ogg") || lower.contains("opus") {
        "opus"
    } else {
        "audio"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::soundcloud_kernel::types::*;

    fn t(preset: Option<&str>, protocol: &str, mime: &str, url: &str) -> Transcoding {
        Transcoding {
            url: url.to_string(),
            preset: preset.map(String::from),
            format: TranscodingFormat {
                protocol: protocol.to_string(),
                mime_type: mime.to_string(),
            },
            quality: None,
        }
    }

    fn t_hq(preset: Option<&str>, protocol: &str, mime: &str, url: &str) -> Transcoding {
        Transcoding {
            quality: Some("hq".to_string()),
            ..t(preset, protocol, mime, url)
        }
    }

    fn track_with(transcodings: Vec<Transcoding>) -> Track {
        Track {
            id: 1,
            title: "x".into(),
            duration: 0,
            artwork_url: None,
            user: TrackUser { username: "u".into() },
            media: Media { transcodings },
            kind: Some("track".into()),
        }
    }

    #[test]
    fn prefers_progressive_mp3() {
        let track = track_with(vec![
            t(Some("hls_aac_128"), "hls", "audio/mp4", "hls.url"),
            t(Some("mp3_1_0"), "progressive", "audio/mpeg", "mp3.url"),
            t(Some("opus_1_0"), "progressive", "audio/ogg", "opus.url"),
        ]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.url, "mp3.url");
        assert_eq!(picked.extension, "mp3");
    }

    #[test]
    fn falls_back_to_progressive_non_mp3() {
        let track = track_with(vec![
            t(Some("hls_aac_128"), "hls", "audio/mp4", "hls.url"),
            t(Some("opus_1_0"), "progressive", "audio/ogg", "opus.url"),
        ]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.url, "opus.url");
        assert_eq!(picked.extension, "opus");
    }

    // Shape observed live on api-v2 (2026-11): no progressive at all.
    #[test]
    fn picks_best_plain_hls_when_no_progressive() {
        let mut aac160 = t(Some("aac_160k"), "hls", "audio/mp4; codecs=\"mp4a.40.2\"", "160.url");
        aac160.quality = Some("sq".into());
        let mut aac96 = t(Some("aac_96k"), "hls", "audio/mp4; codecs=\"mp4a.40.2\"", "96.url");
        aac96.quality = Some("lq".into());
        let mut abr = t(Some("abr_sq"), "hls", "audio/mpegurl", "abr.url");
        abr.quality = Some("sq".into());
        let track = track_with(vec![aac96, abr, aac160]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.url, "160.url");
        assert_eq!(picked.extension, "m4a");
        assert!(picked.hls);
    }

    #[test]
    fn hls_mp3_gets_mp3_extension() {
        let track = track_with(vec![t(Some("mp3_1_0"), "hls", "audio/mpeg", "hls.url")]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.extension, "mp3");
        assert!(picked.hls);
    }

    #[test]
    fn progressive_still_wins_over_hls() {
        let track = track_with(vec![
            t(Some("aac_160k"), "hls", "audio/mp4", "hls.url"),
            t(Some("mp3_1_0"), "progressive", "audio/mpeg", "mp3.url"),
        ]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.url, "mp3.url");
        assert!(!picked.hls);
    }

    #[test]
    fn errors_when_only_encrypted_hls_available() {
        let track = track_with(vec![
            t(Some("aac_160k"), "cbc-encrypted-hls", "audio/mp4", "a"),
            t(Some("aac_160k"), "ctr-encrypted-hls", "audio/mp4", "b"),
        ]);
        let err = pick_transcoding(&track).unwrap_err();
        assert!(err.contains("DRM-encrypted"), "got: {err}");
    }

    #[test]
    fn protocol_check_is_case_insensitive() {
        let track = track_with(vec![t(
            Some("mp3_1_0"),
            "PROGRESSIVE",
            "audio/mpeg",
            "x",
        )]);
        assert!(pick_transcoding(&track).is_ok());
    }

    #[test]
    fn prefers_hq_mp3_when_user_has_go_plus() {
        let track = track_with(vec![
            t(Some("mp3_1_0"), "progressive", "audio/mpeg", "standard.mp3"),
            t_hq(Some("mp3_0_0"), "progressive", "audio/mpeg", "hq.mp3"),
        ]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.url, "hq.mp3");
    }

    #[test]
    fn extension_inferred_from_mime_when_preset_is_unfamiliar() {
        let track = track_with(vec![t(
            Some("weird_codec_123"),
            "progressive",
            "audio/mp4",
            "weird.url",
        )]);
        let picked = pick_transcoding(&track).unwrap();
        assert_eq!(picked.extension, "m4a");
    }
}
