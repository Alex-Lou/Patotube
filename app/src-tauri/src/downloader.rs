use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use crate::commands::{FormatChoice, StartDownloadInput};
use crate::jobs::JobRegistry;

const PROGRESS_TPL: &str = "PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.speed)s|%(progress.eta)s";

/// Args YouTube needs to dodge anti-bot/age/region walls reliably.
/// The old Patotube Python build used `player_client=['android']`; we keep
/// that and let yt-dlp fall back to web/web_safari if android responds with
/// nothing useful. Adding more clients here is generally safe.
const YT_EXTRACTOR_ARGS: &str =
    "youtube:player_client=default,android,web_safari";

#[derive(Debug, Deserialize)]
struct YtdlpJson {
    title: String,
    duration: Option<f64>,
    thumbnail: Option<String>,
    uploader: Option<String>,
    webpage_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub url: String,
    pub title: String,
    pub uploader: Option<String>,
    pub duration_sec: Option<f64>,
    pub thumbnail: Option<String>,
    pub platform: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    job_id: String,
    bytes_done: u64,
    bytes_total: Option<u64>,
    speed_bps: Option<f64>,
    eta_sec: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StatusPayload {
    job_id: String,
    status: &'static str,
    error: Option<String>,
    file_path: Option<String>,
}

pub async fn fetch_info(app: &AppHandle, url: &str) -> Result<MediaInfo, String> {
    let shell = app.shell();
    let output = shell
        .sidecar("yt-dlp")
        .map_err(|e| format!("sidecar yt-dlp not found: {e}"))?
        .args([
            "--no-playlist",
            "--skip-download",
            "--print-json",
            "--no-warnings",
            "--no-check-certificate",
            "--extractor-args",
            YT_EXTRACTOR_ARGS,
            url,
        ])
        .output()
        .await
        .map_err(|e| format!("yt-dlp invocation failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(friendly_error(&stderr, output.status.code()));
    }

    let info: YtdlpJson = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("could not parse yt-dlp output: {e}"))?;

    Ok(MediaInfo {
        url: info.webpage_url.unwrap_or_else(|| url.to_string()),
        title: info.title,
        uploader: info.uploader,
        duration_sec: info.duration,
        thumbnail: info.thumbnail,
        platform: detect_platform(url),
    })
}

fn detect_platform(url: &str) -> String {
    let lower = url.to_lowercase();
    if lower.contains("youtube.com") || lower.contains("youtu.be") || lower.contains("ytimg") {
        "youtube"
    } else if lower.contains("soundcloud.com") {
        "soundcloud"
    } else if lower.contains(".bandcamp.com") {
        "bandcamp"
    } else if lower.contains("audiomack.com") {
        "audiomack"
    } else if lower.contains("archive.org") {
        "archive"
    } else if lower.contains("spotify.com") {
        "spotify"
    } else if lower.contains("deezer.com") {
        "deezer"
    } else {
        "generic"
    }
    .to_string()
}

pub async fn start(
    app: &AppHandle,
    registry: &JobRegistry,
    input: StartDownloadInput,
) -> Result<(), String> {
    let job_id = input.job_id.clone();
    eprintln!("[patotube] downloader::start invoked job={job_id} url={}", input.url);

    emit_status(app, &job_id, "downloading", None, None);
    eprintln!("[patotube] emit_status downloading sent for job={job_id}");

    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--no-mtime".into(),
        "--no-check-certificate".into(),
        "--restrict-filenames".into(),
        "--newline".into(),
        "--extractor-args".into(),
        YT_EXTRACTOR_ARGS.into(),
        "--progress-template".into(),
        PROGRESS_TPL.into(),
        "--paths".into(),
        input.output_dir.clone(),
        "--output".into(),
        "%(title)s.%(ext)s".into(),
    ];

    // Tell yt-dlp where to find the ffmpeg sidecar. Without this,
    // yt-dlp searches PATH — which on a sideloaded Tauri install
    // doesn't include our `binaries/` folder, so audio extraction
    // (`-x --audio-format mp3`) silently falls back to leaving the
    // raw .webm/.m4a on disk and the user sees a "file not found"
    // error in their player. Pointing at the sidecar location makes
    // it deterministic.
    if let Some(ffmpeg_dir) = ffmpeg_sidecar_dir() {
        args.push("--ffmpeg-location".into());
        args.push(ffmpeg_dir);
    }

    match &input.format {
        FormatChoice::Video { quality } => {
            let h = match quality.as_str() {
                "high" => "[height<=1080]",
                "medium" => "[height<=720]",
                "low" => "[height<=480]",
                _ => "",
            };
            args.push("-f".into());
            args.push(format!("bv*{h}+ba/b{h}/best"));
            args.push("--merge-output-format".into());
            args.push("mp4".into());
        }
        FormatChoice::Audio { bitrate } => {
            args.push("-x".into());
            args.push("--audio-format".into());
            args.push("mp3".into());
            args.push("--audio-quality".into());
            args.push(format!("{bitrate}K"));
        }
    }

    args.push(input.url.clone());

    let shell = app.shell();
    let cmd = shell
        .sidecar("yt-dlp")
        .map_err(|e| {
            eprintln!("[patotube] sidecar resolution failed: {e}");
            format!("sidecar yt-dlp not found: {e}")
        })?
        .args(args);
    eprintln!("[patotube] sidecar resolved, spawning…");

    let (mut rx, child) = cmd.spawn().map_err(|e| {
        eprintln!("[patotube] spawn failed: {e}");
        format!("spawn failed: {e}")
    })?;
    eprintln!("[patotube] yt-dlp spawned for job={job_id}, listening for events");
    registry.register(job_id.clone(), child);

    let app_handle = app.clone();
    let registry_clone = registry.clone();

    tokio::spawn(async move {
        let mut last_file: Option<String> = None;
        let mut last_error: Option<String> = None;
        let mut stderr_buf = String::new();

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    if let Some(p) = parse_progress(&job_id, &line) {
                        let _ = app_handle.emit("download://progress", p);
                    } else if let Some(file) = parse_destination(&line) {
                        last_file = Some(file);
                    } else if let Some(merged) = parse_merging_into(&line) {
                        last_file = Some(merged);
                    } else if let Some(extracted) = parse_extract_audio_dest(&line) {
                        // ExtractAudio renamed the file to its
                        // final form (e.g. .webm → .mp3); update
                        // the tracker so the "open file" toast
                        // points at the right path.
                        last_file = Some(extracted);
                        emit_status(&app_handle, &job_id, "converting", None, None);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    stderr_buf.push_str(trimmed);
                    stderr_buf.push('\n');
                    if line.to_lowercase().contains("error") {
                        last_error = Some(trimmed.to_string());
                    }
                }
                CommandEvent::Terminated(t) => {
                    registry_clone.remove(&job_id);
                    if t.code == Some(0) {
                        emit_status(&app_handle, &job_id, "done", None, last_file.clone());
                    } else {
                        let err = if !stderr_buf.is_empty() {
                            friendly_error(stderr_buf.trim(), t.code)
                        } else {
                            last_error
                                .clone()
                                .unwrap_or_else(|| format!("yt-dlp exited with code {:?}", t.code))
                        };
                        emit_status(&app_handle, &job_id, "failed", Some(err), None);
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Locate the directory holding our `ffmpeg` sidecar so yt-dlp
/// can be pointed at it via `--ffmpeg-location`. Tauri copies the
/// platform-suffixed binaries into `target/<profile>/`, dropping
/// the suffix; we ship from the same dir as the running exe.
///
/// Returns `None` if the current exe path can't be resolved (we
/// then let yt-dlp fall back to its own PATH search). This is a
/// defensive helper: missing ffmpeg only matters for audio
/// extraction, not for raw video downloads.
fn ffmpeg_sidecar_dir() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    Some(dir.to_string_lossy().into_owned())
}

fn parse_progress(job_id: &str, line: &str) -> Option<ProgressPayload> {
    let trimmed = line.trim();
    let rest = trimmed.strip_prefix("PROGRESS|")?;
    let mut parts = rest.split('|');
    let done: u64 = parts.next()?.trim().parse().ok()?;
    let total = parts.next().and_then(|s| s.trim().parse::<u64>().ok());
    let speed = parts.next().and_then(|s| s.trim().parse::<f64>().ok());
    let eta = parts.next().and_then(|s| s.trim().parse::<f64>().ok());
    Some(ProgressPayload {
        job_id: job_id.to_string(),
        bytes_done: done,
        bytes_total: total,
        speed_bps: speed,
        eta_sec: eta,
    })
}

fn parse_destination(line: &str) -> Option<String> {
    line.trim()
        .strip_prefix("[download] Destination: ")
        .map(|s| s.to_string())
}

fn parse_merging_into(line: &str) -> Option<String> {
    line.trim()
        .strip_prefix("[Merger] Merging formats into ")
        .map(|s| s.trim_matches('"').to_string())
}

/// yt-dlp emits `[ExtractAudio] Destination: foo.mp3` after a
/// successful audio post-process. Without parsing this, we
/// continue to report the original `[download] Destination:
/// foo.webm` as the final file — and Windows then tells the
/// user the .webm doesn't exist when they click Open File
/// (because the post-process renamed it to .mp3).
fn parse_extract_audio_dest(line: &str) -> Option<String> {
    line.trim()
        .strip_prefix("[ExtractAudio] Destination: ")
        .map(|s| s.to_string())
}

/// Make yt-dlp's noisy stderr something a user can actually act on.
/// We always include the original stderr at the end so power users keep
/// the full message, but a one-line summary up front explains what's
/// going on for the common cases.
fn friendly_error(stderr: &str, exit_code: Option<i32>) -> String {
    if stderr.is_empty() {
        return format!("yt-dlp exited with code {:?}", exit_code);
    }
    let lower = stderr.to_lowercase();

    let summary = if lower.contains("sign in to confirm") || lower.contains("not a bot") {
        "YouTube is asking us to prove we're not a bot. Sign in via cookies (coming in a future build), or try another URL."
    } else if lower.contains("video unavailable") {
        "This video is unavailable (private, deleted, or region-locked)."
    } else if lower.contains("age") && lower.contains("confirm") {
        "Age-restricted video — yt-dlp needs sign-in cookies to access it."
    } else if lower.contains("private video") {
        "This video is private."
    } else if lower.contains("members-only") || lower.contains("members only") {
        "Members-only video — sign-in required."
    } else if lower.contains("http error 403") || lower.contains("forbidden") {
        "The server refused the request (403). The URL may be region-locked or blocked."
    } else if lower.contains("http error 404") || lower.contains("not found") {
        "The page doesn't exist (404). Check the URL."
    } else if lower.contains("unsupported url") || lower.contains("no video") {
        "This site or URL is not supported by the bundled yt-dlp."
    } else if lower.contains("unable to resolve")
        || lower.contains("name or service not known")
        || lower.contains("no route to host")
        || lower.contains("temporary failure")
    {
        "Network issue — couldn't reach the server. Check your connection."
    } else if lower.contains("ssl") || lower.contains("certificate") {
        "TLS/SSL error reaching the server."
    } else {
        ""
    };

    if summary.is_empty() {
        // Show only the most relevant tail of stderr (yt-dlp tends to dump
        // a lot before the actual error line).
        let tail: String = stderr
            .lines()
            .filter(|l| !l.trim().is_empty())
            .rev()
            .take(3)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        tail
    } else {
        format!("{summary}\n\n{}", stderr.lines().last().unwrap_or(""))
    }
}

fn emit_status(
    app: &AppHandle,
    job_id: &str,
    status: &'static str,
    error: Option<String>,
    file_path: Option<String>,
) {
    let _ = app.emit(
        "download://status",
        StatusPayload {
            job_id: job_id.to_string(),
            status,
            error,
            file_path,
        },
    );
}
