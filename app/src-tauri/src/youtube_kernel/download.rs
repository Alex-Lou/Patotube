// Streaming GET against YouTube CDN with multi-UA retry.
// Different CDN nodes happen to 403 on different UAs even within a
// single video, so we cycle through every known UA before giving up.

use std::path::PathBuf;
use std::time::Instant;

use futures_util::StreamExt;
use tauri::AppHandle;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use super::clients::ALL_CLIENTS;
use super::player_api::http_client;
use crate::events::{emit_progress, ProgressPayload};

const PROGRESS_THROTTLE_MS: u128 = 200;

pub async fn download_stream(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    candidates: &[PathBuf],
    declared_total: Option<u64>,
    primary_user_agent: &str,
) -> Result<PathBuf, String> {
    let mut uas: Vec<&str> = vec![primary_user_agent];
    for c in ALL_CLIENTS {
        if c.user_agent != primary_user_agent {
            uas.push(c.user_agent);
        }
    }

    let mut last_err: Option<String> = None;
    for (i, ua) in uas.iter().enumerate() {
        match try_download_once(app, job_id, url, candidates, declared_total, ua).await {
            Ok(path) => return Ok(path),
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

/// How many times we'll re-open the byte range and keep going after the
/// CDN drops the connection mid-transfer. googlevideo routinely throttles
/// and severs long downloads (a 3-4 h video is hundreds of MB), which
/// surfaced to the user as "stream interrupted: error decoding response
/// body". Each resume continues from the exact byte we'd written, so the
/// file is never corrupted and no bytes are duplicated.
const MAX_RESUMES: u32 = 12;

async fn try_download_once(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    candidates: &[PathBuf],
    declared_total: Option<u64>,
    user_agent: &str,
) -> Result<PathBuf, String> {
    let http = http_client(user_agent)?;
    let (mut file, out_path) = open_first_writable(candidates).await?;

    let mut bytes_done: u64 = 0;
    let mut bytes_total: Option<u64> = declared_total;
    let mut resumes: u32 = 0;
    let mut last_emit = Instant::now();
    let started = Instant::now();

    loop {
        // Resume from exactly where we stopped. On the first pass this is
        // `bytes=0-` (whole file); after a drop it's `bytes=<written>-`.
        let range = format!("bytes={bytes_done}-");
        let response = http
            .get(url)
            .header("Range", &range)
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

        // Establish the true total once, from Content-Range (`bytes a-b/TOTAL`)
        // which is authoritative even on a partial response; fall back to the
        // first response's Content-Length, then to the caller's declared total.
        if bytes_total.is_none() || bytes_done == 0 {
            bytes_total = total_from_response(&response).or(bytes_total);
        }

        let mut stream = response.bytes_stream();
        let mut interrupted = false;

        loop {
            match stream.next().await {
                Some(Ok(chunk)) => {
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
                Some(Err(e)) => {
                    // Connection severed mid-stream — resume below.
                    if resumes >= MAX_RESUMES {
                        return Err(format!(
                            "stream interrupted after {resumes} resumes: {e}"
                        ));
                    }
                    interrupted = true;
                    break;
                }
                None => break, // clean end of this response body
            }
        }

        if interrupted {
            resumes += 1;
            continue;
        }

        // Clean close. If the CDN throttle-closed early (we know the total
        // and haven't reached it), resume; otherwise we're done.
        match bytes_total {
            Some(total) if bytes_done < total => {
                if resumes >= MAX_RESUMES {
                    return Err(format!(
                        "download ended early at {bytes_done}/{total} bytes after {resumes} resumes"
                    ));
                }
                resumes += 1;
                continue;
            }
            _ => break,
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("disk flush error: {e}"))?;
    Ok(out_path)
}

/// Pull the authoritative total size from a (possibly partial) CDN
/// response: `Content-Range: bytes 0-1023/1234567` → 1234567. Falls back
/// to Content-Length, which only equals the total on a non-range/`bytes=0-`
/// first response.
fn total_from_response(resp: &reqwest::Response) -> Option<u64> {
    if let Some(cr) = resp
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|v| v.to_str().ok())
    {
        if let Some(total) = cr.rsplit('/').next().and_then(|s| s.trim().parse::<u64>().ok()) {
            return Some(total);
        }
    }
    resp.content_length()
}

async fn open_first_writable(candidates: &[PathBuf]) -> Result<(File, PathBuf), String> {
    let mut last_err: Option<String> = None;
    for candidate in candidates {
        match File::create(candidate).await {
            Ok(f) => return Ok((f, candidate.clone())),
            Err(e) => {
                eprintln!(
                    "[patotube] yt download: File::create failed at {}: {e}",
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
