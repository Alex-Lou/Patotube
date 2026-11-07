// SoundCloud HLS downloader. Most tracks are now served HLS-only:
// an unencrypted VOD media playlist of fMP4/CMAF segments (init.mp4 +
// dataNNN.m4s) or, on older tracks, raw MP3 segments. Concatenating the
// init segment (if any) followed by every media segment yields a valid,
// playable file — no muxer, no ffmpeg, so it works on Android too.

use std::path::PathBuf;
use std::time::Duration;

use tauri::AppHandle;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use crate::streamer::{cdn_client, open_first_writable, ProgressReporter};

/// The CDN occasionally drops a request; a segment is ~10 s / ~200 KB,
/// so retrying it is cheap and saves an hour-long podcast.
const SEGMENT_ATTEMPTS: u32 = 3;

#[derive(Debug, PartialEq)]
pub struct MediaPlaylist {
    pub init: Option<String>,
    pub segments: Vec<String>,
}

/// Parses a media playlist (not a master playlist). Relative URIs are
/// resolved against `base`. Encrypted playlists are rejected: we can't
/// (and won't) decrypt DRM-protected streams.
pub fn parse_media_playlist(body: &str, base: &str) -> Result<MediaPlaylist, String> {
    if !body.trim_start().starts_with("#EXTM3U") {
        return Err("SoundCloud HLS playlist is malformed (missing #EXTM3U)".into());
    }
    let base = url::Url::parse(base).map_err(|e| format!("bad HLS playlist URL: {e}"))?;
    let resolve = |uri: &str| -> Result<String, String> {
        base.join(uri)
            .map(|u| u.to_string())
            .map_err(|e| format!("bad HLS segment URI: {e}"))
    };

    let mut init = None;
    let mut segments = Vec::new();
    for line in body.lines().map(str::trim).filter(|l| !l.is_empty()) {
        if let Some(attrs) = line.strip_prefix("#EXT-X-KEY:") {
            if !attrs.contains("METHOD=NONE") {
                return Err("SoundCloud track is DRM-encrypted (encrypted HLS)".into());
            }
        } else if line.starts_with("#EXT-X-STREAM-INF") {
            return Err("expected an HLS media playlist, got a master playlist".into());
        } else if let Some(attrs) = line.strip_prefix("#EXT-X-MAP:") {
            let uri = attr_value(attrs, "URI")
                .ok_or_else(|| "HLS #EXT-X-MAP without URI".to_string())?;
            init = Some(resolve(uri)?);
        } else if !line.starts_with('#') {
            segments.push(resolve(line)?);
        }
    }

    if segments.is_empty() {
        return Err("SoundCloud HLS playlist has no segments".into());
    }
    Ok(MediaPlaylist { init, segments })
}

fn attr_value<'a>(attrs: &'a str, key: &str) -> Option<&'a str> {
    let start = attrs.find(&format!("{key}=\""))? + key.len() + 2;
    let len = attrs[start..].find('"')?;
    Some(&attrs[start..start + len])
}

/// Downloads every segment of the playlist at `playlist_url` into the
/// first writable candidate, emitting progress as it goes.
pub async fn download_to_disk(
    app: &AppHandle,
    job_id: &str,
    playlist_url: &str,
    candidates: &[PathBuf],
) -> Result<PathBuf, String> {
    let http = cdn_client()?;
    let body = fetch_with_retry(&http, playlist_url).await?;
    let playlist = parse_media_playlist(&String::from_utf8_lossy(&body), playlist_url)?;

    let (mut file, out_path) = open_first_writable(candidates).await?;
    eprintln!(
        "[patotube] sc-hls: {} segments → {}",
        playlist.segments.len(),
        out_path.display()
    );

    match write_playlist(app, job_id, &http, &playlist, &mut file).await {
        Ok(()) => Ok(out_path),
        Err(e) => {
            drop(file);
            // A truncated concatenation still opens as a valid (short)
            // file — never leave one behind looking like a success.
            let _ = tokio::fs::remove_file(&out_path).await;
            Err(e)
        }
    }
}

async fn write_playlist(
    app: &AppHandle,
    job_id: &str,
    http: &reqwest::Client,
    playlist: &MediaPlaylist,
    file: &mut File,
) -> Result<(), String> {
    let mut progress = ProgressReporter::new(app, job_id);
    let mut bytes_done = match &playlist.init {
        Some(init) => write_fetched(http, init, file).await?,
        None => 0,
    };

    let total = playlist.segments.len() as u64;
    for (i, url) in playlist.segments.iter().enumerate() {
        bytes_done += write_fetched(http, url, file).await?;
        let done = i as u64 + 1;
        // Segments are near-constant size, so extrapolating from the
        // ones already fetched gives an honest total for the bar/ETA.
        progress.report(bytes_done, Some(bytes_done * total / done), done == total);
    }

    file.flush()
        .await
        .map_err(|e| format!("disk flush error: {e}"))
}

/// Fetches one segment fully before writing it, so a retried request
/// never leaves half a segment in the file. Memory stays bounded to a
/// single segment (~200 KB).
async fn write_fetched(http: &reqwest::Client, url: &str, file: &mut File) -> Result<u64, String> {
    let bytes = fetch_with_retry(http, url).await?;
    file.write_all(&bytes)
        .await
        .map_err(|e| format!("disk write error: {e}"))?;
    Ok(bytes.len() as u64)
}

async fn fetch_with_retry(http: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let mut last_err = String::new();
    for attempt in 1..=SEGMENT_ATTEMPTS {
        match http.get(url).send().await {
            Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                Ok(b) => return Ok(b.into()),
                Err(e) => last_err = format!("stream interrupted: {e}"),
            },
            // 4xx won't fix itself (expired/forbidden URL) — fail fast.
            Ok(resp) if resp.status().is_client_error() => {
                return Err(format!("SoundCloud CDN returned status {}", resp.status()));
            }
            Ok(resp) => last_err = format!("SoundCloud CDN returned status {}", resp.status()),
            Err(e) => last_err = format!("CDN connection error: {e}"),
        }
        if attempt < SEGMENT_ATTEMPTS {
            tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
        }
    }
    Err(last_err)
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "https://cdn.example/track/aac_160k/playlist.m3u8?sig=1";

    #[test]
    fn parses_fmp4_playlist_with_init_segment() {
        let body = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-PLAYLIST-TYPE:VOD\n\
                    #EXT-X-MAP:URI=\"https://cdn.example/init.mp4?s=1\"\n\
                    #EXTINF:10.0,\nhttps://cdn.example/data000.m4s?s=1\n\
                    #EXTINF:10.0,\nhttps://cdn.example/data001.m4s?s=1\n#EXT-X-ENDLIST\n";
        let p = parse_media_playlist(body, BASE).unwrap();
        assert_eq!(p.init.as_deref(), Some("https://cdn.example/init.mp4?s=1"));
        assert_eq!(p.segments.len(), 2);
        assert_eq!(p.segments[1], "https://cdn.example/data001.m4s?s=1");
    }

    #[test]
    fn parses_mp3_playlist_without_init_and_resolves_relative_uris() {
        let body = "#EXTM3U\n#EXTINF:10.0,\nseg0.mp3\n#EXTINF:10.0,\n../other/seg1.mp3\n";
        let p = parse_media_playlist(body, BASE).unwrap();
        assert_eq!(p.init, None);
        assert_eq!(p.segments[0], "https://cdn.example/track/aac_160k/seg0.mp3");
        assert_eq!(p.segments[1], "https://cdn.example/track/other/seg1.mp3");
    }

    #[test]
    fn rejects_encrypted_playlist() {
        let body = "#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI=\"skd://x\"\n#EXTINF:10,\ns.m4s\n";
        let err = parse_media_playlist(body, BASE).unwrap_err();
        assert!(err.contains("DRM-encrypted"), "got: {err}");
    }

    #[test]
    fn accepts_explicit_method_none_key() {
        let body = "#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:10,\ns.m4s\n";
        assert!(parse_media_playlist(body, BASE).is_ok());
    }

    #[test]
    fn rejects_master_playlist_and_empty_playlist() {
        let master = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvariant.m3u8\n";
        assert!(parse_media_playlist(master, BASE).unwrap_err().contains("master"));
        let empty = "#EXTM3U\n#EXT-X-ENDLIST\n";
        assert!(parse_media_playlist(empty, BASE).unwrap_err().contains("no segments"));
        assert!(parse_media_playlist("<html>", BASE).unwrap_err().contains("malformed"));
    }
}
