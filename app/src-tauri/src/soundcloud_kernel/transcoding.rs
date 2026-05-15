#![allow(dead_code)]

use super::types::{Track, Transcoding};

#[derive(Debug, Clone)]
pub struct PickedTranscoding {
    pub url: String,
    pub extension: &'static str,
}

// HLS-only → caller surfaces clear error (no HLS player on mobile).
pub fn pick_progressive(track: &Track) -> Result<PickedTranscoding, String> {
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
        });
    }

    let any = track
        .media
        .transcodings
        .iter()
        .find(|t| is_progressive(t))
        .ok_or_else(|| {
            "track has no progressive transcoding (HLS only) — not yet supported on mobile"
                .to_string()
        })?;

    Ok(PickedTranscoding {
        url: any.url.clone(),
        extension: extension_from_mime(&any.format.mime_type),
    })
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
        let picked = pick_progressive(&track).unwrap();
        assert_eq!(picked.url, "mp3.url");
        assert_eq!(picked.extension, "mp3");
    }

    #[test]
    fn falls_back_to_progressive_non_mp3() {
        let track = track_with(vec![
            t(Some("hls_aac_128"), "hls", "audio/mp4", "hls.url"),
            t(Some("opus_1_0"), "progressive", "audio/ogg", "opus.url"),
        ]);
        let picked = pick_progressive(&track).unwrap();
        assert_eq!(picked.url, "opus.url");
        assert_eq!(picked.extension, "opus");
    }

    #[test]
    fn errors_when_only_hls_available() {
        let track = track_with(vec![
            t(Some("hls_aac_128"), "hls", "audio/mp4", "hls1.url"),
            t(Some("hls_mp3_1_0"), "hls", "audio/mpeg", "hls2.url"),
        ]);
        match pick_progressive(&track) {
            Ok(_) => panic!("expected error"),
            Err(e) => assert!(e.contains("HLS only"), "got: {e}"),
        }
    }

    #[test]
    fn protocol_check_is_case_insensitive() {
        let track = track_with(vec![t(
            Some("mp3_1_0"),
            "PROGRESSIVE",
            "audio/mpeg",
            "x",
        )]);
        assert!(pick_progressive(&track).is_ok());
    }

    #[test]
    fn prefers_hq_mp3_when_user_has_go_plus() {
        let track = track_with(vec![
            t(Some("mp3_1_0"), "progressive", "audio/mpeg", "standard.mp3"),
            t_hq(Some("mp3_0_0"), "progressive", "audio/mpeg", "hq.mp3"),
        ]);
        let picked = pick_progressive(&track).unwrap();
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
        let picked = pick_progressive(&track).unwrap();
        assert_eq!(picked.extension, "m4a");
    }
}
