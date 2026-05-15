// SC api-v2 HTTP layer. On 401, refresh client_id + retry once
// to absorb SC's occasional key rotation.

use serde_json::Value;

use super::client_id::{get_client_id, refresh_client_id};
use super::types::{StreamRedirect, Track};
use super::url::is_short_url;

const RESOLVE_ENDPOINT: &str = "https://api-v2.soundcloud.com/resolve";
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

pub async fn resolve_track(track_url: &str) -> Result<Track, String> {
    // on.soundcloud.com/<token> short links 404 against resolve;
    // must be expanded via HTTP redirect first (mobile share sheet
    // emits these by default).
    let canonical_url = if is_short_url(track_url) {
        expand_short_url(track_url).await?
    } else {
        track_url.to_string()
    };

    let body: Value = call_with_retry(|client_id| {
        let url = canonical_url.clone();
        async move {
            let http = build_http()?;
            let response = http
                .get(RESOLVE_ENDPOINT)
                .query(&[("url", url.as_str()), ("client_id", client_id.as_str())])
                .send()
                .await
                .map_err(|e| format!("network error contacting SC resolve: {e}"))?;
            Ok(response)
        }
    })
    .await?;

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

// SC time-bombs the CDN URL → fresh per-download fetch, no upstream caching.
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

async fn expand_short_url(short_url: &str) -> Result<String, String> {
    let http = build_http()?;
    let response = http
        .get(short_url)
        .send()
        .await
        .map_err(|e| format!("network error expanding SC short URL: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "SoundCloud short URL expansion returned {}",
            response.status()
        ));
    }

    let final_url = response.url().to_string();
    // Sanity check: expansion must have moved off on.soundcloud.com,
    // else we'd just 404 again on the next hop.
    if final_url.contains("://on.soundcloud.com/") {
        return Err("SoundCloud short URL did not redirect to a canonical track URL".into());
    }
    // Strip tracking params (utm_source=…) the resolver doesn't want.
    let no_frag = final_url
        .split_once('#')
        .map(|(a, _)| a)
        .unwrap_or(&final_url);
    let no_query = no_frag.split_once('?').map(|(a, _)| a).unwrap_or(no_frag);
    Ok(no_query.to_string())
}
