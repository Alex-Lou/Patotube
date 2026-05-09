// Generic streaming HTTPS GET helper, shared by every kernel that
// hits a "plain" CDN (one URL, no Range games, no auth header
// dance): SoundCloud, Bandcamp, Audiomack, Internet Archive.
//
// YouTube has its own, beefier downloader under
// `youtube_kernel/download.rs` because its CDN demands per-request
// gymnastics (multi-UA retry, Range, Origin/Referer). For every
// other kernel, this 50-line helper is enough.
//
// Reuses the central `events::ProgressPayload` so the frontend
// only needs one listener.

use std::path::PathBuf;
use std::time::Instant;

use futures_util::StreamExt;
use tauri::AppHandle;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use crate::events::{emit_progress, ProgressPayload};

const PROGRESS_THROTTLE_MS: u128 = 200;
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Stream `url` to the first writable path in `candidates`. Tries
/// each in order: opens the file, on EACCES (or any File::create
/// error) moves to the next candidate. The first candidate that
/// accepts the create wins; we then commit to that path for the
/// whole download.
///
/// Returns the path that was actually used, so the caller can
/// surface it back to the frontend.
pub async fn stream_to_disk(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    candidates: &[PathBuf],
) -> Result<PathBuf, String> {
    if candidates.is_empty() {
        return Err("no destination candidates provided".into());
    }

    let http = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let response = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("CDN connection error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("CDN returned status {}", response.status()));
    }

    let bytes_total = response.content_length();

    // Pick a writable destination by attempting File::create on
    // each candidate. On Android scoped storage often blocks the
    // public Download dir but accepts the app-external one — the
    // candidate list reflects that fallback order.
    let (mut file, out_path) = open_first_writable(candidates).await?;
    eprintln!(
        "[patotube] streamer: writing to {} (content-length: {:?})",
        out_path.display(),
        bytes_total
    );

    let mut stream = response.bytes_stream();
    let mut bytes_done: u64 = 0;
    let mut last_emit = Instant::now();
    let started = Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream interrupted: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("disk write error: {e}"))?;
        bytes_done += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= PROGRESS_THROTTLE_MS {
            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            let speed = bytes_done as f64 / elapsed;
            let eta = bytes_total
                .filter(|&t| t > bytes_done && speed > 0.0)
                .map(|t| (t - bytes_done) as f64 / speed);
            emit_progress(
                app,
                ProgressPayload {
                    job_id: job_id.to_string(),
                    bytes_done,
                    bytes_total,
                    speed_bps: Some(speed),
                    eta_sec: eta,
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("disk flush error: {e}"))?;
    Ok(out_path)
}

/// Try `File::create` on each candidate in order, returning the
/// first that succeeds with both the open file and the path
/// chosen. Surfaces the LAST error if every candidate fails.
async fn open_first_writable(
    candidates: &[PathBuf],
) -> Result<(File, PathBuf), String> {
    let mut last_err: Option<String> = None;
    for candidate in candidates {
        match File::create(candidate).await {
            Ok(file) => return Ok((file, candidate.clone())),
            Err(e) => {
                eprintln!(
                    "[patotube] streamer: File::create failed at {}: {e}",
                    candidate.display()
                );
                last_err = Some(format!("{}: {e}", candidate.display()));
            }
        }
    }
    Err(format!(
        "could not write to download folder: every candidate refused. Last error: {}",
        last_err.unwrap_or_else(|| "(unknown)".into())
    ))
}
