// Streaming GET against YouTube CDN with multi-UA retry.
// Different CDN nodes happen to 403 on different UAs even within a
// single video, so we cycle through every known UA before giving up.

use std::path::PathBuf;
use std::time::Instant;

use futures_util::StreamExt;
use tauri::AppHandle;
use tokio::fs::File;
use tokio::io::{AsyncSeekExt, AsyncWriteExt};

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

/// Consecutive failed attempts (no byte written in between) before giving
/// up. googlevideo routinely severs long downloads; each retry continues
/// from the exact byte written, so the file is never corrupted and no
/// bytes are duplicated.
const MAX_RESUMES: u32 = 12;

/// googlevideo throttles an open-ended range to about real-time speed
/// after the first few MB, so a 2 h video took about 2 h (and Android had
/// plenty of time to kill the app). Asking for ~10 MB ranges, like yt-dlp
/// does, keeps the full speed.
const CHUNK_BYTES: u64 = 10 * 1024 * 1024;

/// `Range` header for the next chunk, clamped to the known total.
fn chunk_range(start: u64, total: Option<u64>) -> String {
    let mut end = start + CHUNK_BYTES - 1;
    if let Some(t) = total.filter(|&t| t > 0) {
        end = end.min(t - 1);
    }
    format!("bytes={start}-{end}")
}

/// Short, growing pause before retrying, so a flapping connection is not
/// hammered (1 s, 2 s, ... capped at 5 s).
async fn retry_pause(failures: u32) {
    tokio::time::sleep(std::time::Duration::from_secs(u64::from(failures.min(5)))).await;
}

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
    // Consecutive failures since the last byte written; reset by progress,
    // so a 3 h video may hit many transient drops and still finish.
    let mut failures: u32 = 0;
    let mut last_emit = Instant::now();
    let started = Instant::now();

    loop {
        if bytes_total.is_some_and(|t| t > 0 && bytes_done >= t) {
            break;
        }
        let range = chunk_range(bytes_done, bytes_total);
        let response = match http
            .get(url)
            .header("Range", &range)
            .header("Accept", "*/*")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Origin", "https://www.youtube.com")
            .header("Referer", "https://www.youtube.com/")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                // A connect/read hiccup between chunks: retry from the same
                // byte instead of throwing away everything written so far.
                failures += 1;
                if failures > MAX_RESUMES {
                    return Err(format!("CDN connection error after {failures} attempts: {e}"));
                }
                retry_pause(failures).await;
                continue;
            }
        };

        let status = response.status().as_u16();
        // 416 = we asked past the end: the previous chunk was the last one.
        if status == 416 && bytes_done > 0 {
            break;
        }
        if !(200..300).contains(&status) {
            // 403 / 410 typically mean the signed URL expired or this UA is
            // refused: the caller retries the whole download with another UA.
            return Err(format!("CDN returned status {}", response.status()));
        }
        // A resume answered with the whole file (200, Range ignored)
        // must not be appended after the bytes already written: start
        // the file over instead of corrupting it.
        if restarts_from_scratch(bytes_done, status) {
            file.set_len(0).await.map_err(|e| format!("disk truncate error: {e}"))?;
            file.seek(std::io::SeekFrom::Start(0))
                .await
                .map_err(|e| format!("disk seek error: {e}"))?;
            bytes_done = 0;
        }

        // Establish the true total once, from Content-Range (`bytes a-b/TOTAL`)
        // which is authoritative even on a partial response; fall back to the
        // first response's Content-Length, then to the caller's declared total.
        if bytes_total.is_none() || bytes_done == 0 {
            bytes_total = total_from_response(&response).or(bytes_total);
        }

        let mut stream = response.bytes_stream();
        let mut delivered: u64 = 0;
        let mut interrupted = false;

        loop {
            match stream.next().await {
                Some(Ok(chunk)) => {
                    file.write_all(&chunk)
                        .await
                        .map_err(|e| format!("disk write error: {e}"))?;
                    bytes_done += chunk.len() as u64;
                    delivered += chunk.len() as u64;
                    failures = 0;

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
                    // Connection severed mid-chunk: resume from bytes_done.
                    failures += 1;
                    if failures > MAX_RESUMES {
                        return Err(format!("stream interrupted after {failures} attempts: {e}"));
                    }
                    interrupted = true;
                    break;
                }
                None => break, // clean end of this chunk
            }
        }

        if interrupted {
            retry_pause(failures).await;
            continue;
        }
        if bytes_total.is_none() && delivered < CHUNK_BYTES {
            // Unknown size and a short chunk: that was the end of the file.
            break;
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

/// True when a resume request (`bytes_done > 0`) got the full file
/// back (200) instead of the requested range (206).
fn restarts_from_scratch(bytes_done: u64, status: u16) -> bool {
    bytes_done > 0 && status != 206
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

#[cfg(test)]
mod tests {
    use super::{chunk_range, restarts_from_scratch, CHUNK_BYTES};

    #[test]
    fn chunk_range_asks_for_bounded_pieces() {
        assert_eq!(chunk_range(0, None), format!("bytes=0-{}", CHUNK_BYTES - 1));
        assert_eq!(
            chunk_range(5, Some(10 * CHUNK_BYTES)),
            format!("bytes=5-{}", 5 + CHUNK_BYTES - 1)
        );
    }

    #[test]
    fn chunk_range_stops_at_the_last_byte() {
        assert_eq!(chunk_range(90, Some(100)), "bytes=90-99");
        // A zero total (unknown size reported as 0) is ignored.
        assert_eq!(chunk_range(0, Some(0)), format!("bytes=0-{}", CHUNK_BYTES - 1));
    }

    #[test]
    fn resume_ignored_by_cdn_restarts_the_file() {
        assert!(restarts_from_scratch(1024, 200));
        assert!(!restarts_from_scratch(1024, 206));
        assert!(!restarts_from_scratch(0, 200));
        assert!(!restarts_from_scratch(0, 206));
    }
}
