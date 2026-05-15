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

#[derive(Clone)]
struct CacheEntry {
    stream: ResolvedStream,
    inserted: Instant,
}

static CACHE: Lazy<DashMap<String, CacheEntry>> = Lazy::new(DashMap::new);

pub async fn handle(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() == Method::OPTIONS {
        return cors_preflight();
    }

    let video_id = match extract_video_id(&request) {
        Some(id) => id,
        None => return error(StatusCode::BAD_REQUEST, "missing video id"),
    };

    let stream = match get_or_resolve(&video_id).await {
        Ok(s) => s,
        Err(e) => return error(StatusCode::BAD_GATEWAY, &format!("resolve: {e}")),
    };

    let client = match reqwest::Client::builder()
        .user_agent(&stream.user_agent)
        .build()
    {
        Ok(c) => c,
        Err(e) => return error(StatusCode::INTERNAL_SERVER_ERROR, &format!("client: {e}")),
    };

    let mut upstream = client.get(&stream.url);
    if let Some(range) = request.headers().get(header::RANGE) {
        if let Ok(v) = range.to_str() {
            upstream = upstream.header(header::RANGE, v);
        }
    }

    let resp = match upstream.send().await {
        Ok(r) => r,
        Err(e) => {
            // Force a re-resolve on the next try — the cached URL
            // may have expired or been invalidated server-side.
            CACHE.remove(&video_id);
            return error(StatusCode::BAD_GATEWAY, &format!("upstream: {e}"));
        }
    };

    let status = resp.status();
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
    // Same-origin from the WebView's perspective, but some browsers
    // still gate `<video>` behind a permissive CORS header.
    builder = builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    builder = builder.header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range");

    let body = match resp.bytes().await {
        Ok(b) => b.to_vec(),
        Err(e) => return error(StatusCode::BAD_GATEWAY, &format!("body: {e}")),
    };

    builder
        .body(body)
        .unwrap_or_else(|_| error(StatusCode::INTERNAL_SERVER_ERROR, "build response"))
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
