use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use crate::commands::{FormatChoice, StartDownloadInput};
use crate::jobs::JobRegistry;

const PROGRESS_TPL: &str = "PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.speed)s|%(progress.eta)s";

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
            url,
        ])
        .output()
        .await
        .map_err(|e| format!("yt-dlp invocation failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("yt-dlp exited with code {:?}", output.status.code())
        } else {
            stderr
        });
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

    emit_status(app, &job_id, "downloading", None, None);

    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--no-mtime".into(),
        "--restrict-filenames".into(),
        "--newline".into(),
        "--progress-template".into(),
        PROGRESS_TPL.into(),
        "--paths".into(),
        input.output_dir.clone(),
        "--output".into(),
        "%(title)s.%(ext)s".into(),
    ];

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
        .map_err(|e| format!("sidecar yt-dlp not found: {e}"))?
        .args(args);

    let (mut rx, child) = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    registry.register(job_id.clone(), child);

    let app_handle = app.clone();
    let registry_clone = registry.clone();

    tokio::spawn(async move {
        let mut last_file: Option<String> = None;
        let mut last_error: Option<String> = None;

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
                    } else if line.contains("[ExtractAudio]") {
                        emit_status(&app_handle, &job_id, "converting", None, None);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    if line.to_lowercase().contains("error") {
                        last_error = Some(line.trim().to_string());
                    }
                }
                CommandEvent::Terminated(t) => {
                    registry_clone.remove(&job_id);
                    if t.code == Some(0) {
                        emit_status(&app_handle, &job_id, "done", None, last_file.clone());
                    } else {
                        emit_status(
                            &app_handle,
                            &job_id,
                            "failed",
                            Some(last_error.clone().unwrap_or_else(|| {
                                format!("yt-dlp exited with code {:?}", t.code)
                            })),
                            None,
                        );
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
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
