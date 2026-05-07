#![allow(dead_code)]

// Picks one stream out of YouTube's `formats` / `adaptiveFormats`
// arrays. Returns (url, contentLength, originalExt) tuples that the
// downloader uses verbatim.

use super::types::{Format, StreamingData};

/// Pick the best playable combined-MP4 stream within the user's
/// quality cap. We deliberately walk three filters:
///   1. mp4 + height ≤ cap   (preferred — universal player support)
///   2. any container + height ≤ cap   (fallback)
///   3. any url-bearing format   (last resort)
///
/// Quality strings are kept in lock-step with the frontend's
/// `VIDEO_QUALITIES` enum.
pub fn pick_video(
    streaming: &StreamingData,
    quality: &str,
) -> Result<(String, Option<u64>, &'static str), String> {
    let height_cap: u32 = match quality {
        "high" => 1080,
        "medium" => 720,
        "low" => 480,
        _ => 4320,
    };

    let chosen = streaming
        .formats
        .iter()
        .filter(|f| f.url.is_some())
        .filter(|f| f.height <= height_cap)
        .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.contains("mp4")))
        .max_by_key(|f| f.height)
        .or_else(|| {
            streaming
                .formats
                .iter()
                .filter(|f| f.url.is_some())
                .filter(|f| f.height <= height_cap)
                .max_by_key(|f| f.height)
        })
        .or_else(|| streaming.formats.iter().find(|f| f.url.is_some()))
        .ok_or_else(|| "No compatible MP4 stream available.".to_string())?;

    let url = chosen
        .url
        .clone()
        .ok_or_else(|| "Selected video stream has no URL.".to_string())?;
    let total = parse_total_bytes(chosen);
    Ok((url, total, "mp4"))
}

/// Pick the best audio-only stream. We prefer m4a (mp4-container AAC)
/// because every Android music app reads it without quirks; webm/opus
/// is the fallback for videos where YouTube only offers Opus
/// adaptive audio.
pub fn pick_audio(
    streaming: &StreamingData,
) -> Result<(String, Option<u64>, &'static str), String> {
    let chosen = streaming
        .adaptive_formats
        .iter()
        .filter(|f| f.url.is_some())
        .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.starts_with("audio/mp4")))
        .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        .or_else(|| {
            streaming
                .adaptive_formats
                .iter()
                .filter(|f| f.url.is_some())
                .filter(|f| f.mime_type.as_deref().is_some_and(|m| m.starts_with("audio/")))
                .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        })
        .ok_or_else(|| "No audio-only stream available for this video.".to_string())?;

    let url = chosen
        .url
        .clone()
        .ok_or_else(|| "Selected audio stream has no URL.".to_string())?;
    let total = parse_total_bytes(chosen);

    let ext = chosen
        .mime_type
        .as_deref()
        .map(|m| if m.contains("webm") { "webm" } else { "m4a" })
        .unwrap_or("m4a");
    Ok((url, total, ext))
}

fn parse_total_bytes(f: &Format) -> Option<u64> {
    f.content_length.as_deref().and_then(|s| s.parse::<u64>().ok())
}
