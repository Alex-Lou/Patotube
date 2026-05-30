// Custom URI scheme `patostream://` that proxies YouTube CDN
// playback so the in-app preview <video> tag never talks to
// googlevideo.com directly. Two problems this solves:
//
//   1. User-Agent matching. The CDN signs URLs against the client
//      profile that resolved them (ANDROID_VR, IOS, …). A WebView2
//      UA hitting an ANDROID_VR URL gets 403. The proxy replays
//      the original UA.
//
//   2. CORS. The WebView treats `https://googlevideo.com` as a
//      cross-origin resource. A custom URI scheme served by Tauri
//      is same-origin from the frontend's point of view.
//
// Frontend builds URLs as `patostream://localhost/<video_id>`
// (Linux/macOS) or `https://patostream.localhost/<video_id>`
// (Windows). `convertFileSrc` in @tauri-apps/api/core handles the
// platform branch automatically.

use std::time::{Duration, Instant};

use dashmap::DashMap;
use once_cell::sync::Lazy;
use tauri::http::{header, Method, Request, Response, StatusCode};

use crate::youtube_kernel::stream_url::{resolve, ResolvedStream};

// CDN URLs are valid for ~6h. We keep them well below to avoid
// serving a stale signature on the edge of expiry.
const CACHE_TTL: Duration = Duration::from_secs(60 * 60 * 4);

/// Maximum number of bytes returned per Range response. Without this
/// the Android WebView issues `Range: bytes=0-` (open-ended) on the
/// initial fetch, googlevideo happily streams the entire 200-MB file,
/// and `resp.bytes().await` buffers it ALL in RAM before we can
/// respond → `java.lang.OutOfMemoryError: Failed to allocate a
/// 286715944 byte allocation` (caught on a real device).
///
/// 4 MiB is a sweet spot: large enough that the WebView usually gets
/// the MP4 metadata box on the first chunk and can start playing
/// without further round-trips, small enough that we stay ~50× below
/// the OOM threshold and don't stall slow-cellular initial loads.
const MAX_CHUNK_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Clone)]
struct CacheEntry {
    stream: ResolvedStream,
    inserted: Instant,
}

static CACHE: Lazy<DashMap<String, CacheEntry>> = Lazy::new(DashMap::new);

// Shared HTTP client — connection pooling + DNS cache survive
// across the chatty Range requests a <video> tag fires.
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .pool_idle_timeout(Duration::from_secs(30))
        .pool_max_idle_per_host(8)
        // Generous total timeout per request — large chunks on a
        // slow link can take a while. Connect timeout is shorter.
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .expect("http client")
});

pub async fn handle(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() == Method::OPTIONS {
        return cors_preflight();
    }

    let video_id = match extract_video_id(&request) {
        Some(id) => id,
        None => return error(StatusCode::BAD_REQUEST, "missing video id"),
    };

    let range_header: Option<String> = request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    // Clamp the upstream Range so each response stays ≤ MAX_CHUNK_BYTES
    // — see the const docs for the OOM rationale.
    let clamped_range = clamp_range(range_header.as_deref());

    // Try up to twice: first with whatever's cached, then force a
    // fresh resolve if the upstream fails (transient drop, expired
    // signed URL, googlevideo rotated the host, etc.). This is what
    // a <video> tag bouncing in and out of PiP / background trips
    // most often — keeps the pipeline error message off the screen.
    let mut last_error: String = String::from("unreached");
    for attempt in 0..2 {
        if attempt == 1 {
            // Drop the cache so get_or_resolve goes back to the
            // YouTube player API for a fresh signed URL.
            CACHE.remove(&video_id);
        }

        let stream = match get_or_resolve(&video_id).await {
            Ok(s) => s,
            Err(e) => {
                last_error = format!("resolve: {e}");
                continue;
            }
        };

        let req = HTTP_CLIENT
            .get(&stream.url)
            .header(header::USER_AGENT, &stream.user_agent)
            .header(header::RANGE, &clamped_range);

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("upstream: {e}");
                continue;
            }
        };

        let status = resp.status();
        // 403 / 410 / 5xx from googlevideo typically mean the URL
        // expired or the CDN node rotated. Re-resolve and retry.
        if status == StatusCode::FORBIDDEN
            || status == StatusCode::GONE
            || status.is_server_error()
        {
            last_error = format!("upstream status {status}");
            continue;
        }

        let mut builder = Response::builder().status(status.as_u16());
        for (k, v) in resp.headers() {
            let name = k.as_str().to_ascii_lowercase();
            if matches!(
                name.as_str(),
                "content-type"
                    | "content-length"
                    | "content-range"
                    | "accept-ranges"
                    | "last-modified"
                    | "etag"
                    | "cache-control"
            ) {
                builder = builder.header(k.clone(), v.clone());
            }
        }
        builder = builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
        builder = builder.header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range");

        let body = match resp.bytes().await {
            Ok(b) => b.to_vec(),
            Err(e) => {
                last_error = format!("body: {e}");
                continue;
            }
        };

        return builder
            .body(body)
            .unwrap_or_else(|_| error(StatusCode::INTERNAL_SERVER_ERROR, "build response"));
    }

    error(StatusCode::BAD_GATEWAY, &last_error)
}

/// Parse `Range: bytes=START-END?` and rewrite the upper bound so the
/// upstream returns at most MAX_CHUNK_BYTES. Always emits a closed
/// range so googlevideo replies with `206 Partial Content` instead of
/// streaming everything.
fn clamp_range(incoming: Option<&str>) -> String {
    let default_chunk = format!("bytes=0-{}", MAX_CHUNK_BYTES - 1);
    let Some(raw) = incoming else { return default_chunk };
    let Some(spec) = raw.strip_prefix("bytes=") else { return default_chunk };
    // Only the first range is honoured (multi-range responses are
    // exotic and the WebView never asks for them).
    let first = spec.split(',').next().unwrap_or("");
    let mut parts = first.splitn(2, '-');
    let start: u64 = parts.next().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
    let max_end = start.saturating_add(MAX_CHUNK_BYTES).saturating_sub(1);
    let requested_end: Option<u64> = parts
        .next()
        .and_then(|s| {
            let t = s.trim();
            if t.is_empty() { None } else { t.parse().ok() }
        });
    let end = match requested_end {
        Some(e) => std::cmp::min(e, max_end),
        None => max_end,
    };
    format!("bytes={start}-{end}")
}

fn extract_video_id(request: &Request<Vec<u8>>) -> Option<String> {
    let path = request.uri().path();
    let id = path.trim_matches('/').split('/').last()?;
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
}

async fn get_or_resolve(video_id: &str) -> Result<ResolvedStream, String> {
    if let Some(entry) = CACHE.get(video_id) {
        if entry.inserted.elapsed() < CACHE_TTL {
            return Ok(entry.stream.clone());
        }
    }
    let stream = resolve(video_id).await?;
    CACHE.insert(
        video_id.to_string(),
        CacheEntry {
            stream: stream.clone(),
            inserted: Instant::now(),
        },
    );
    Ok(stream)
}

fn error(status: StatusCode, msg: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(msg.as_bytes().to_vec())
        .expect("build error response")
}

fn cors_preflight() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
        .body(Vec::new())
        .expect("build preflight")
}
