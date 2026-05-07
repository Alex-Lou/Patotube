// Streaming GET against a YouTube CDN URL with multi-UA retry.
// YouTube's CDN tends to 403 plain GETs; sending a Range header plus
// the right user-agent cooperates. Different CDN nodes happen to
// 403 on different UAs even within a single video, so we cycle
// through every UA we know about before giving up.

use std::path::Path;
use std::time::Instant;

use futures_util::StreamExt;
use tauri::AppHandle;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use super::clients::ALL_CLIENTS;
use super::player_api::http_client;
use super::progress::{emit_progress, ProgressPayload};

const PROGRESS_THROTTLE_MS: u128 = 200;

pub async fn download_stream(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    out_path: &Path,
    declared_total: Option<u64>,
    primary_user_agent: &str,
) -> Result<(), String> {
    let mut uas: Vec<&str> = vec![primary_user_agent];
    for c in ALL_CLIENTS {
        if c.user_agent != primary_user_agent {
            uas.push(c.user_agent);
        }
    }

    let mut last_err: Option<String> = None;
    for (i, ua) in uas.iter().enumerate() {
        match try_download_once(app, job_id, url, out_path, declared_total, ua).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                let recoverable = e.contains("403") || e.contains("CDN");
                if i + 1 < uas.len() && recoverable {
                    last_err = Some(e);
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "All download attempts failed.".into()))
}

async fn try_download_once(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    out_path: &Path,
    declared_total: Option<u64>,
    user_agent: &str,
) -> Result<(), String> {
    let http = http_client(user_agent)?;
    // Range + matching client UA + youtube.com Origin/Referer is the
    // shape the official apps use. Plain GETs get 403'd from most
    // CDN nodes within seconds.
    let response = http
        .get(url)
        .header("Range", "bytes=0-")
        .header("Accept", "*/*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Origin", "https://www.youtube.com")
        .header("Referer", "https://www.youtube.com/")
        .send()
        .await
        .map_err(|e| format!("CDN connection error: {e}"))?;

    let status = response.status();
    if !(status.is_success() || status.as_u16() == 206) {
        return Err(format!("CDN returned status {status}"));
    }

    let bytes_total = response.content_length().or(declared_total);
    let mut file = File::create(out_path)
        .await
        .map_err(|e| format!("could not write to download folder: {e}"))?;

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
