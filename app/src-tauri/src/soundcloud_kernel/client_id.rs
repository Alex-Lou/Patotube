#![allow(dead_code)]

// SC api-v2 needs a `client_id`. Extract at runtime: fetch homepage,
// walk <script src=…> tags in REVERSE (late bundles hold the key),
// regex out a 32-char `client_id: "…"` literal. In-process cache;
// caller refreshes on 401 (occasional SC key rotation).

use std::sync::Mutex;

use once_cell::sync::Lazy;
use regex::Regex;

const HOMEPAGE_URL: &str = "https://soundcloud.com/";
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

static CACHED_CLIENT_ID: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub async fn get_client_id() -> Result<String, String> {
    if let Some(cached) = read_cache() {
        return Ok(cached);
    }
    let fresh = extract_fresh_client_id().await?;
    write_cache(&fresh);
    Ok(fresh)
}

pub async fn refresh_client_id() -> Result<String, String> {
    let fresh = extract_fresh_client_id().await?;
    write_cache(&fresh);
    Ok(fresh)
}

async fn extract_fresh_client_id() -> Result<String, String> {
    let http = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let homepage = http
        .get(HOMEPAGE_URL)
        .send()
        .await
        .map_err(|e| format!("network error fetching SC homepage: {e}"))?
        .text()
        .await
        .map_err(|e| format!("could not read SC homepage body: {e}"))?;

    let script_urls = extract_script_urls(&homepage);
    if script_urls.is_empty() {
        return Err("SC homepage returned no <script> tags".into());
    }

    // Walk in reverse — bundles holding the client_id literal
    // are typically the last script tags.
    for url in script_urls.iter().rev() {
        let body = match http.get(url).send().await {
            Ok(r) if r.status().is_success() => match r.text().await {
                Ok(t) => t,
                Err(_) => continue,
            },
            _ => continue,
        };
        if let Some(id) = find_client_id(&body) {
            return Ok(id);
        }
    }
    Err("client_id not found in any SC script bundle".into())
}

pub fn extract_script_urls(html: &str) -> Vec<String> {
    let re = match Regex::new(r#"<script[^>]+src="([^"]+)""#) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };
    re.captures_iter(html)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

pub fn find_client_id(js: &str) -> Option<String> {
    let re = Regex::new(r#"client_id\s*:\s*"([0-9a-zA-Z]{32})""#).ok()?;
    re.captures(js)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

fn read_cache() -> Option<String> {
    CACHED_CLIENT_ID.lock().ok().and_then(|g| g.clone())
}

fn write_cache(id: &str) {
    if let Ok(mut g) = CACHED_CLIENT_ID.lock() {
        *g = Some(id.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_script_urls_finds_all() {
        let html = r#"
            <html>
                <script src="/a.js"></script>
                <script src="/b.js" type="text/javascript"></script>
                <script>inline()</script>
                <script src="https://cdn/c.js"></script>
            </html>
        "#;
        let urls = extract_script_urls(html);
        assert_eq!(urls, vec!["/a.js", "/b.js", "https://cdn/c.js"]);
    }

    #[test]
    fn find_client_id_picks_32_alphanumeric_literal() {
        let js = r#"
            var config = {
                client_id: "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
                other: "thing"
            };
        "#;
        assert_eq!(
            find_client_id(js).as_deref(),
            Some("AbCdEfGhIjKlMnOpQrStUvWxYz012345"),
        );
    }

    #[test]
    fn find_client_id_rejects_short_literal() {
        // Decoy: a 16-char client_id elsewhere in the file. Real
        // SC keys are exactly 32 chars; the regex enforces that.
        let js = r#"client_id: "tooshort1234abcd""#;
        assert!(find_client_id(js).is_none());
    }

    #[test]
    fn find_client_id_handles_whitespace_around_colon() {
        let js = r#"  client_id  :  "0123456789abcdef0123456789abcdef" "#;
        assert_eq!(
            find_client_id(js).as_deref(),
            Some("0123456789abcdef0123456789abcdef"),
        );
    }

    #[test]
    fn find_client_id_returns_none_when_absent() {
        assert!(find_client_id("nothing here").is_none());
    }
}
