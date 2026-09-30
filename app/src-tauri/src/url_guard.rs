// Shared URL checks for everything that reaches the network or a
// sidecar. Classifiers must compare the parsed host, never do a
// substring match on the raw string (`http://127.0.0.1/x.bandcamp.com`
// would otherwise be fetched as if it were Bandcamp).

use url::Url;

/// Lower-cased host of an http(s) URL, or `None` for anything else
/// (other schemes, relative strings, garbage).
pub fn http_host(raw: &str) -> Option<String> {
    let url = Url::parse(raw.trim()).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    url.host_str().map(|h| h.to_ascii_lowercase())
}

/// Gate for Tauri commands that take a user URL. Rejects non-http(s)
/// input so nothing starting with `-` can ever be read as a yt-dlp
/// option, and no `file://` / custom scheme reaches the kernels.
pub fn ensure_http_url(raw: &str) -> Result<(), String> {
    if http_host(raw).is_some() {
        Ok(())
    } else {
        Err("unsupported URL: only http(s) links are accepted".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_lowercase_host() {
        assert_eq!(
            http_host("HTTPS://Artist.Bandcamp.com/track/x").as_deref(),
            Some("artist.bandcamp.com")
        );
        assert_eq!(http_host("  http://a.b/c  ").as_deref(), Some("a.b"));
    }

    #[test]
    fn rejects_non_http_schemes_and_garbage() {
        assert!(http_host("file:///etc/passwd").is_none());
        assert!(http_host("javascript:alert(1)").is_none());
        assert!(http_host("--exec=rm -rf /").is_none());
        assert!(http_host("not a url").is_none());
        assert!(http_host("").is_none());
    }

    #[test]
    fn ensure_http_url_accepts_only_http() {
        assert!(ensure_http_url("https://www.youtube.com/watch?v=abc").is_ok());
        assert!(ensure_http_url("-o /tmp/x").is_err());
        assert!(ensure_http_url("ftp://example.com/a").is_err());
    }
}
