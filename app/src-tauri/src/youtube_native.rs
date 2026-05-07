// Pure-Rust YouTube extractor for Android.
//
// We hit YouTube's internal `youtubei/v1/player` API directly, the same
// way yt-dlp does with `--player-client=...`. Different "clients" return
// streams with very different restrictions:
//   - TVHTML5_SIMPLY_EMBEDDED_PLAYER: most permissive, no PoToken needed
//   - IOS: solid fallback, mp4+aac streams
//   - ANDROID: fast but YouTube increasingly cripples it
// We try them in that order until one returns playable formats. The
// returned URLs are direct CDN links — no signature cipher, no JS, no
// QuickJS, no rustypipe. Pure reqwest streaming.
//
// Audio (M4A) is supported via adaptiveFormats: itag 140 is the standard
// AAC ~128 kbps audio-only stream that every music player reads fine. We
// don't transcode to MP3 since that would need ffmpeg, which we don't
// ship on Android yet.

#![cfg(target_os = "android")]

use std::path::PathBuf;
use std::time::Instant;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

use crate::commands::{FormatChoice, StartDownloadInput};
use crate::downloader::MediaInfo;
use crate::jobs::JobRegistry;

const PLAYER_ENDPOINT: &str = "https://youtubei.googleapis.com/youtubei/v1/player";

/// Order matters: clients more likely to return playable combined streams
/// (audio+video in one URL) first. IOS has the cleanest mp4 output today;
/// ANDROID still works for many videos; TVHTML5_SIMPLY_EMBEDDED_PLAYER is
/// the last-resort fallback for restricted content (its streams are
/// typically adaptive-only, no combined mp4).
///
/// `ANDROID_MUSIC` is special: it talks to the YouTube Music backend,
/// which returns audio-only m4a URLs that the CDN serves without the
/// PoToken / n-parameter dance regular YouTube audio now requires.
const CLIENT_ATTEMPTS: &[ClientProfile] = &[
    ClientProfile {
        name: "IOS",
        version: "20.10.4",
        api_key: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
        user_agent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
        client_id: "5",
        os_name: "iOS",
        os_version: "18.3.2.22D82",
        extra_context: Some(r#"{"deviceMake":"Apple","deviceModel":"iPhone16,2"}"#),
    },
    ClientProfile {
        name: "ANDROID",
        version: "20.10.38",
        api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
        user_agent: "com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US) gzip",
        client_id: "3",
        os_name: "Android",
        os_version: "13",
        extra_context: Some(r#"{"androidSdkVersion":34}"#),
    },
    ClientProfile {
        name: "ANDROID_MUSIC",
        version: "7.27.52",
        api_key: "AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXEo8AI",
        user_agent: "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 14)",
        client_id: "21",
        os_name: "Android",
        os_version: "14",
        extra_context: Some(r#"{"androidSdkVersion":34}"#),
    },
    ClientProfile {
        name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        version: "2.0",
        api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        user_agent: "Mozilla/5.0 (PlayStation 4 5.55) AppleWebKit/601.2 (KHTML, like Gecko)",
        client_id: "85",
        os_name: "Tizen",
        os_version: "5.0",
        extra_context: None,
    },
];

#[derive(Debug, Clone, Copy)]
struct ClientProfile {
    name: &'static str,
    version: &'static str,
    api_key: &'static str,
    user_agent: &'static str,
    client_id: &'static str,
    os_name: &'static str,
    os_version: &'static str,
    extra_context: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
struct PlayerResponse {
    #[serde(rename = "videoDetails")]
    video_details: Option<VideoDetails>,
    #[serde(rename = "streamingData")]
    streaming_data: Option<StreamingData>,
    #[serde(rename = "playabilityStatus")]
    playability_status: Option<PlayabilityStatus>,
}

#[derive(Debug, Deserialize)]
struct VideoDetails {
    #[serde(rename = "videoId")]
    video_id: String,
    title: String,
    #[serde(rename = "lengthSeconds", default)]
    length_seconds: String,
    author: Option<String>,
    thumbnail: Option<ThumbnailContainer>,
}

#[derive(Debug, Deserialize)]
struct ThumbnailContainer {
    thumbnails: Vec<Thumbnail>,
}

#[derive(Debug, Deserialize)]
struct Thumbnail {
    url: String,
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
}

#[derive(Debug, Deserialize)]
struct StreamingData {
    #[serde(default)]
    formats: Vec<Format>,
    #[serde(rename = "adaptiveFormats", default)]
    adaptive_formats: Vec<Format>,
}

#[derive(Debug, Deserialize, Clone)]
struct Format {
    url: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    #[serde(default)]
    height: u32,
    #[serde(rename = "contentLength")]
    content_length: Option<String>,
    #[serde(rename = "averageBitrate")]
    average_bitrate: Option<u64>,
    #[serde(rename = "audioQuality")]
    audio_quality: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlayabilityStatus {
    status: Option<String>,
    reason: Option<String>,
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

fn http_client(user_agent: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(user_agent)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))
}

async fn call_player_api(
    client: &ClientProfile,
    video_id: &str,
) -> Result<PlayerResponse, String> {
    let http = http_client(client.user_agent)?;
    let mut client_ctx = json!({
        "clientName": client.name,
        "clientVersion": client.version,
        "hl": "en",
        "gl": "US",
        "userAgent": client.user_agent,
        "osName": client.os_name,
        "osVersion": client.os_version,
    });
    if let Some(extra) = client.extra_context {
        if let Ok(extra_value) = serde_json::from_str::<Value>(extra) {
            if let (Some(obj), Some(extra_obj)) =
                (client_ctx.as_object_mut(), extra_value.as_object())
            {
                for (k, v) in extra_obj {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }
    }
    let body = json!({
        "context": { "client": client_ctx },
        "videoId": video_id,
        "playbackContext": {
            "contentPlaybackContext": { "html5Preference": "HTML5_PREF_WANTS" }
        },
        "contentCheckOk": true,
        "racyCheckOk": true,
    });

    let response = http
        .post(format!("{PLAYER_ENDPOINT}?key={}", client.api_key))
        .header("X-YouTube-Client-Name", client.client_id)
        .header("X-YouTube-Client-Version", client.version)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error contacting youtube: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("youtube returned status {status}"));
    }

    response
        .json::<PlayerResponse>()
        .await
        .map_err(|e| format!("could not parse youtube response: {e}"))
}

/// Iterates through the client list and returns the first response that
/// satisfies `accept`. Used to require combined formats for video DL or
/// audio-only formats for audio DL — different clients have different
/// stream sets and different CDN-side restrictions.
async fn resolve_player_with(
    clients: &[&'static ClientProfile],
    video_id: &str,
    accept: impl Fn(&PlayerResponse) -> bool,
) -> Result<(PlayerResponse, &'static ClientProfile), String> {
    let mut last_error: Option<String> = None;
    for client in clients.iter().copied() {
        match call_player_api(client, video_id).await {
            Ok(resp) => {
                let playable = resp
                    .playability_status
                    .as_ref()
                    .and_then(|s| s.status.as_deref())
                    .map(|s| s == "OK")
                    .unwrap_or(true);

                if playable && accept(&resp) {
                    return Ok((resp, client));
                }
                let reason = resp
                    .playability_status
                    .as_ref()
                    .and_then(|s| s.reason.clone())
                    .or_else(|| {
                        resp.playability_status
                            .as_ref()
                            .and_then(|s| s.status.clone())
                    })
                    .unwrap_or_else(|| "no usable streams".into());
                last_error = Some(format!("{}: {reason}", client.name));
            }
            Err(e) => {
                last_error = Some(format!("{}: {e}", client.name));
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "All YouTube clients refused.".into()))
}

fn has_metadata(resp: &PlayerResponse) -> bool {
    resp.video_details.is_some()
}

/// Default client order — used for metadata fetches and as the basis for
/// the per-format orders below. IOS first because its mp4 streams are
/// the cleanest of the three.
fn default_clients() -> Vec<&'static ClientProfile> {
    CLIENT_ATTEMPTS.iter().collect()
}

/// For audio downloads: ANDROID_MUSIC first. The YouTube Music backend
/// hands out audio URLs the CDN serves without PoToken/n-param checks,
/// which is the cliff regular YouTube audio falls off in 2025. ANDROID
/// is the second-best fallback for content not on YT Music.
fn audio_clients() -> Vec<&'static ClientProfile> {
    let preferred = ["ANDROID_MUSIC", "ANDROID", "IOS", "TVHTML5_SIMPLY_EMBEDDED_PLAYER"];
    let mut v: Vec<&'static ClientProfile> = Vec::new();
    for name in preferred {
        if let Some(c) = CLIENT_ATTEMPTS.iter().find(|c| c.name == name) {
            v.push(c);
        }
    }
    v
}

async fn resolve_player(
    video_id: &str,
    accept: impl Fn(&PlayerResponse) -> bool,
) -> Result<(PlayerResponse, &'static ClientProfile), String> {
    let clients = default_clients();
    resolve_player_with(&clients, video_id, accept).await
}

fn has_combined_video(resp: &PlayerResponse) -> bool {
    resp.streaming_data
        .as_ref()
        .map(|s| s.formats.iter().any(|f| f.url.is_some()))
        .unwrap_or(false)
}

fn has_audio_only(resp: &PlayerResponse) -> bool {
    resp.streaming_data
        .as_ref()
        .map(|s| {
            s.adaptive_formats.iter().any(|f| {
                f.url.is_some()
                    && f.mime_type
                        .as_deref()
                        .is_some_and(|m| m.starts_with("audio/"))
            })
        })
        .unwrap_or(false)
}

pub async fn fetch_info(url: &str) -> Result<MediaInfo, String> {
    let video_id = extract_youtube_id(url)
        .ok_or_else(|| "Not a recognised YouTube URL.".to_string())?;

    let (resp, _client) = resolve_player(&video_id, has_metadata).await?;

    let details = resp
        .video_details
        .ok_or_else(|| "Video metadata missing.".to_string())?;

    let duration_sec = details
        .length_seconds
        .parse::<f64>()
        .ok()
        .filter(|&d| d > 0.0);

    let thumbnail = details
        .thumbnail
        .map(|c| c.thumbnails)
        .and_then(|t| {
            t.into_iter()
                .max_by_key(|x| x.width as u64 * x.height as u64)
                .map(|x| x.url)
        });

    Ok(MediaInfo {
        url: format!("https://www.youtube.com/watch?v={}", details.video_id),
        title: details.title,
        uploader: details.author,
        duration_sec,
        thumbnail,
        platform: "youtube".into(),
    })
}

pub async fn start(
    app: &AppHandle,
    registry: &JobRegistry,
    input: StartDownloadInput,
) -> Result<(), String> {
    let job_id = input.job_id.clone();
    emit_status(app, &job_id, "downloading", None, None);

    let video_id = extract_youtube_id(&input.url)
        .ok_or_else(|| "Not a recognised YouTube URL.".to_string())?;

    let want_audio = matches!(input.format, FormatChoice::Audio { .. });

    let title_raw = match resolve_player(&video_id, has_metadata).await {
        Ok((r, _)) => r
            .video_details
            .map(|d| d.title)
            .unwrap_or_else(|| video_id.clone()),
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };
    let title = sanitize_filename(&title_raw);

    let _ = &input.output_dir; // kept for desktop parity

    let app_handle = app.clone();
    let registry_clone = registry.clone();
    let video_id_owned = video_id.clone();
    let format_choice = input.format.clone();

    tokio::spawn(async move {
        let result = run_download(
            &app_handle,
            &job_id,
            &video_id_owned,
            &title,
            format_choice,
            want_audio,
        )
        .await;

        match result {
            Ok(path) => {
                emit_status(
                    &app_handle,
                    &job_id,
                    "done",
                    None,
                    Some(path.to_string_lossy().into_owned()),
                );
            }
            Err(err) => {
                emit_status(&app_handle, &job_id, "failed", Some(err), None);
            }
        }
        registry_clone.remove(&job_id);
    });

    Ok(())
}

/// Drives the actual download with audio fallback. For audio requests
/// we try audio-only first; if every YouTube client + UA combination
/// 403s on the CDN, we fall back to grabbing the combined MP4 stream
/// (which already carries an AAC audio track) and saving it as `.m4a`.
/// The audio plays in any music app even though the file technically
/// also contains a video stream — this side-steps PoToken-protected
/// audio-only URLs without needing ffmpeg.
async fn run_download(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    format: FormatChoice,
    want_audio: bool,
) -> Result<PathBuf, String> {
    if want_audio {
        // First attempt: real audio-only stream.
        match try_audio_only(app, job_id, video_id, title).await {
            Ok(p) => return Ok(p),
            Err(e) => {
                eprintln!("[patotube] audio-only failed: {e} — falling back to combined mp4");
            }
        }
        // Fallback: combined mp4, saved as .m4a so music players pick it up.
        return try_combined(app, job_id, video_id, title, "best", "m4a").await;
    }
    let quality = match format {
        FormatChoice::Video { quality } => quality,
        FormatChoice::Audio { .. } => "best".into(),
    };
    try_combined(app, job_id, video_id, title, &quality, "mp4").await
}

async fn try_audio_only(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
) -> Result<PathBuf, String> {
    let clients = audio_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_audio_only).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let (url, total, ext) = pick_audio(&streaming)?;
    let out = resolve_output_path(&format!("{title}.{ext}")).await?;
    download_stream(app, job_id, &url, &out, total, client.user_agent).await?;
    Ok(out)
}

async fn try_combined(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    quality: &str,
    save_ext: &str,
) -> Result<PathBuf, String> {
    let clients = default_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_combined_video).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let (url, total, _real_ext) = pick_video(&streaming, quality)?;
    let out = resolve_output_path(&format!("{title}.{save_ext}")).await?;
    download_stream(app, job_id, &url, &out, total, client.user_agent).await?;
    Ok(out)
}

fn pick_video(
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
        .filter(|f| {
            f.mime_type
                .as_deref()
                .is_some_and(|m| m.contains("mp4"))
        })
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
    let total = chosen
        .content_length
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok());
    Ok((url, total, "mp4"))
}

fn pick_audio(
    streaming: &StreamingData,
) -> Result<(String, Option<u64>, &'static str), String> {
    // Prefer m4a (mp4-container AAC) — universally readable.
    let chosen = streaming
        .adaptive_formats
        .iter()
        .filter(|f| f.url.is_some())
        .filter(|f| {
            f.mime_type
                .as_deref()
                .is_some_and(|m| m.starts_with("audio/mp4"))
        })
        .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        .or_else(|| {
            // Fall back to any audio-only stream (probably webm/opus).
            streaming
                .adaptive_formats
                .iter()
                .filter(|f| f.url.is_some())
                .filter(|f| {
                    f.mime_type
                        .as_deref()
                        .is_some_and(|m| m.starts_with("audio/"))
                })
                .max_by_key(|f| f.average_bitrate.unwrap_or(0))
        })
        .ok_or_else(|| "No audio-only stream available for this video.".to_string())?;

    let url = chosen
        .url
        .clone()
        .ok_or_else(|| "Selected audio stream has no URL.".to_string())?;
    let total = chosen
        .content_length
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok());

    let ext = chosen
        .mime_type
        .as_deref()
        .map(|m| if m.contains("webm") { "webm" } else { "m4a" })
        .unwrap_or("m4a");
    Ok((url, total, ext))
}

/// Resolves the actual on-disk path to write a downloaded file on Android.
///
/// Public `/storage/emulated/0/Download/` is gated behind scoped storage
/// since Android 11 — direct file writes there silently route into a
/// sandbox or just fail, leaving the user wondering where the file went.
/// We skip it entirely and write to the app's external files dir, which
/// the OS always lets us access without permissions and which any modern
/// file manager exposes under:
///
///     Internal storage → Android → data → io.patotube.app → files → Download
///
/// The package name has to stay in sync with `tauri.conf.json` identifier.
async fn resolve_output_path(filename: &str) -> Result<PathBuf, String> {
    let candidates = [
        // Primary: ROOT of public /sdcard/Download. We save files at
        // the very root (no Patotube subfolder) so every Android file
        // manager picks them up in the default "Downloads" view —
        // Xiaomi's Mes Fichiers, Samsung My Files, Google Files, etc.
        // all hide subfolders from that view.
        "/storage/emulated/0/Download",
        // Fallback: app-external. Always writable, always visible
        // through Internal storage → Android → data → io.patotube.app
        // → files → Download.
        "/storage/emulated/0/Android/data/io.patotube.app/files/Download",
        // Last-resort: app-private internal. Hidden from file managers
        // but always writable.
        "/data/data/io.patotube.app/files/Download",
    ];
    let mut last_err: Option<String> = None;
    for dir in candidates {
        let p = PathBuf::from(dir);
        if let Err(e) = tokio::fs::create_dir_all(&p).await {
            last_err = Some(format!("{dir}: {e}"));
            continue;
        }
        let probe = p.join(".patotube-probe");
        match tokio::fs::write(&probe, b"probe").await {
            Ok(()) => {
                let _ = tokio::fs::remove_file(&probe).await;
                return Ok(p.join(filename));
            }
            Err(e) => {
                last_err = Some(format!("{dir}: {e}"));
            }
        }
    }
    Err(format!(
        "No writable download folder. Last error: {}",
        last_err.unwrap_or_else(|| "none".into())
    ))
}

async fn download_stream(
    app: &AppHandle,
    job_id: &str,
    url: &str,
    out_path: &PathBuf,
    declared_total: Option<u64>,
    primary_user_agent: &str,
) -> Result<(), String> {
    // Some CDN nodes 403 specific UA combinations. Retry across all the
    // client UAs we know about so an audio stream resolved by IOS but
    // 403'd on download still succeeds via the ANDROID UA.
    let mut uas: Vec<&str> = vec![primary_user_agent];
    for c in CLIENT_ATTEMPTS {
        if c.user_agent != primary_user_agent {
            uas.push(c.user_agent);
        }
    }

    let mut last_err: Option<String> = None;
    for (i, ua) in uas.iter().enumerate() {
        match try_download_once(app, job_id, url, out_path, declared_total, ua).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                let is_403 = e.contains("403");
                if i + 1 < uas.len() && (is_403 || e.contains("CDN")) {
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
    out_path: &PathBuf,
    declared_total: Option<u64>,
    user_agent: &str,
) -> Result<(), String> {
    let http = http_client(user_agent)?;
    // The YouTube CDN tends to 403 plain GET requests. Sending a Range
    // header (even an open-ended one) along with a matching client UA
    // makes it cooperate the same way the official apps do.
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

        if last_emit.elapsed().as_millis() >= 200 {
            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            let speed = bytes_done as f64 / elapsed;
            let eta = bytes_total
                .filter(|&t| t > bytes_done && speed > 0.0)
                .map(|t| (t - bytes_done) as f64 / speed);
            let _ = app.emit(
                "download://progress",
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

fn extract_youtube_id(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if let Some(rest) = trimmed
        .strip_prefix("https://youtu.be/")
        .or_else(|| trimmed.strip_prefix("http://youtu.be/"))
    {
        return Some(rest.split(['/', '?', '#']).next()?.to_string());
    }

    let lower = trimmed.to_lowercase();
    if lower.contains("youtube.com") {
        if let Some(idx) = trimmed.find("v=") {
            let rest = &trimmed[idx + 2..];
            return Some(rest.split(['&', '#']).next()?.to_string());
        }
        for prefix in ["/shorts/", "/embed/", "/v/"] {
            if let Some(idx) = trimmed.find(prefix) {
                let rest = &trimmed[idx + prefix.len()..];
                return Some(rest.split(['/', '?', '#']).next()?.to_string());
            }
        }
    }
    None
}

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    cleaned
        .trim_matches(|c: char| c == '.' || c.is_whitespace())
        .chars()
        .take(140)
        .collect()
}
