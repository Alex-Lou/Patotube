// HTTP layer for SoundCloud's api-v2 backend. All calls are
// authenticated via a `client_id=…` query string; we obtain that
// via `client_id::get_client_id()` and pass it on every request.
//
// On 401 we refresh the cached client_id and retry once — SC
// rotates the published key occasionally and we don't want a
// cold cache to brick downloads for the rest of the process.

#![cfg(target_os = "android")]

use serde_json::Value;

use super::client_id::{get_client_id, refresh_client_id};
use super::types::{StreamRedirect, Track};

const RESOLVE_ENDPOINT: &str = "https://api-v2.soundcloud.com/resolve";
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Resolve a track URL to its full metadata, including the
/// `media.transcodings` list a downloader picks from.
pub async fn resolve_track(track_url: &str) -> Result<Track, String> {
    let body: Value = call_with_retry(|client_id| async move {
        let http = build_http()?;
        let response = http
            .get(RESOLVE_ENDPOINT)
            .query(&[("url", track_url), ("client_id", client_id.as_str())])
            .send()
            .await
            .map_err(|e| format!("network error contacting SC resolve: {e}"))?;
        Ok(response)
    })
    .await?;

    // The resolve endpoint returns either a Track JSON object
    // (kind="track") or, for playlist/user URLs, a different
    // shape we don't handle yet. Fail informatively when we
    // get something unexpected.
    let kind = body
        .get("kind")
        .and_then(|k| k.as_str())
        .unwrap_or("(unknown)");
    if kind != "track" {
        return Err(format!(
            "SoundCloud URL is a {kind}, not a single track — only track downloads are supported"
        ));
    }

    serde_json::from_value(body)
        .map_err(|e| format!("could not parse SC track JSON: {e}"))
}

/// Hit a transcoding's resolver URL to get the actual streamable
/// CDN URL. This is a separate per-format call (yes, two HTTP
/// hops total per download) — SC time-bombs the CDN URL so it
/// can't be cached upstream.
pub async fn fetch_stream_url(transcoding_url: &str) -> Result<String, String> {
    let body: StreamRedirect = call_with_retry(|client_id| {
        let url = transcoding_url.to_string();
        async move {
            let http = build_http()?;
            let response = http
                .get(&url)
                .query(&[("client_id", client_id.as_str())])
                .send()
                .await
                .map_err(|e| format!("network error fetching stream URL: {e}"))?;
            Ok(response)
        }
    })
    .await?;
    Ok(body.url)
}

/// Wraps a one-shot SC API call with the retry-on-401 contract:
///   1. Fetch with the cached client_id.
///   2. On 401, refresh and try once more.
///   3. Otherwise, return the parsed JSON or the HTTP error.
async fn call_with_retry<T, F, Fut>(make_request: F) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
    F: Fn(String) -> Fut + Send,
    Fut: std::future::Future<Output = Result<reqwest::Response, String>> + Send,
{
    let mut id = get_client_id().await?;
    let mut attempts = 0;
    loop {
        let response = make_request(id.clone()).await?;
        let status = response.status();

        if status.is_success() {
            return response
                .json::<T>()
                .await
                .map_err(|e| format!("could not parse SC response: {e}"));
        }

        // Single retry on auth failure to absorb a key rotation.
        if status.as_u16() == 401 && attempts == 0 {
            attempts += 1;
            id = refresh_client_id().await?;
            continue;
        }

        return Err(format!("SoundCloud returned status {status}"));
    }
}

fn build_http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))
}
