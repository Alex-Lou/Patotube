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

use std::path::Path;
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

pub async fn stream_to_disk(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    out_path: &Path,
) -> Result<(), String> {
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
    eprintln!(
        "[patotube] streamer: opening {} for write (content-length: {:?})",
        out_path.display(),
        bytes_total
    );
    let mut file = File::create(out_path).await.map_err(|e| {
        eprintln!(
            "[patotube] streamer: File::create failed at {}: {e}",
            out_path.display()
        );
        format!("could not write to download folder: {e}")
    })?;

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
    Ok(())
}
