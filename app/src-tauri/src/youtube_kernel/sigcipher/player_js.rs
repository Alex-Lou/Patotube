// Fetch + cache YouTube's player.js. The JS file changes a few
// times per week (YouTube ships subtle obfuscation tweaks); each
// version has a unique URL like
// `https://www.youtube.com/s/player/abc12345/player_ias.vflset/en_US/base.js`,
// so a hash of the URL doubles as a cache key for the
// signature/n-decoder closures we build from it.
//
// We deliberately keep the cache small (capacity 4) and clear-on-
// process-restart. YouTube usually serves the same player.js URL
// for hours at a time, so even a tiny cache catches every
// download in a session.

use std::sync::Mutex;

use once_cell::sync::Lazy;
use regex::Regex;

const PLAYER_JS_CACHE_CAPACITY: usize = 4;

/// In-process LRU-ish cache. We don't bother with a real LRU
/// data structure because capacity is 4 — a `Vec<(key, value)>`
/// with linear probing is faster than juggling a HashMap+linked-list.
static PLAYER_JS_CACHE: Lazy<Mutex<Vec<(String, String)>>> =
    Lazy::new(|| Mutex::new(Vec::with_capacity(PLAYER_JS_CACHE_CAPACITY)));

const DESKTOP_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                          (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Fetch a watch page's HTML. Used to locate the player.js URL for
/// a specific video; YouTube ships different player.js URLs across
/// short windows (~hours) so the URL has to be discovered rather
/// than guessed.
pub async fn fetch_watch_page_html(video_id: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let response = client
        .get(&url)
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| format!("network error fetching watch page: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "watch page returned status {}",
            response.status()
        ));
    }
    response
        .text()
        .await
        .map_err(|e| format!("could not read watch page body: {e}"))
}

/// Convenience: fetch the watch page for `video_id`, pull the
/// `jsUrl` field out of the embedded player config, and follow it to
/// fetch the player.js source. Returns `(player_js_url, source)`.
pub async fn fetch_player_js_for_video(video_id: &str) -> Result<(String, String), String> {
    let html = fetch_watch_page_html(video_id).await?;
    let js_url = extract_player_js_url(&html)
        .ok_or_else(|| "watch page did not contain a player.js URL".to_string())?;
    let source = fetch_player_js(&js_url).await?;
    Ok((js_url, source))
}

/// Fetch the JS at `url` (typically a player.js URL extracted from
/// a watch page), returning the raw source. Hits the cache first;
/// on miss does an HTTPS GET with a desktop-shaped User-Agent so
/// YouTube serves the same player.js variant the regex extractors
/// were tuned against.
pub async fn fetch_player_js(url: &str) -> Result<String, String> {
    if let Some(hit) = read_cache(url) {
        return Ok(hit);
    }

    let client = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("network error fetching player.js: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("player.js returned status {}", response.status()));
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("could not read player.js body: {e}"))?;

    write_cache(url, &body);
    Ok(body)
}

/// Pull the player.js URL out of a YouTube watch-page HTML blob.
/// The URL appears as `"jsUrl":"/s/player/.../base.js"` in the
/// initial player config; we promote it to an absolute URL.
pub fn extract_player_js_url(watch_page_html: &str) -> Option<String> {
    let re = Regex::new(r#""jsUrl"\s*:\s*"(/s/player/[^"]+/base\.js)""#).ok()?;
    let caps = re.captures(watch_page_html)?;
    let path = caps.get(1)?.as_str();
    Some(format!("https://www.youtube.com{path}"))
}

fn read_cache(url: &str) -> Option<String> {
    let cache = PLAYER_JS_CACHE.lock().ok()?;
    cache
        .iter()
        .find(|(k, _)| k == url)
        .map(|(_, v)| v.clone())
}

fn write_cache(url: &str, body: &str) {
    let Ok(mut cache) = PLAYER_JS_CACHE.lock() else {
        return;
    };
    if cache.iter().any(|(k, _)| k == url) {
        return;
    }
    if cache.len() >= PLAYER_JS_CACHE_CAPACITY {
        cache.remove(0); // evict oldest
    }
    cache.push((url.to_string(), body.to_string()));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_jsurl_from_watch_page_html() {
        let html = r#"
            <!doctype html>
            <html><head><script>
            var ytcfg = {"PLAYER_JS_URL":"old","jsUrl":"/s/player/abc12345/player_ias.vflset/en_US/base.js","other":"thing"};
            </script></head></html>
        "#;
        assert_eq!(
            extract_player_js_url(html),
            Some("https://www.youtube.com/s/player/abc12345/player_ias.vflset/en_US/base.js".into()),
        );
    }

    #[test]
    fn returns_none_when_jsurl_missing() {
        assert_eq!(extract_player_js_url("<html></html>"), None);
    }

    // The cache is shared global state, so unit tests would race
    // when run in parallel. The logic is small and easy to read by
    // inspection — we verify it via integration use rather than
    // unit tests here.
}
