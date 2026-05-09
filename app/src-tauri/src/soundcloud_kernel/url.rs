// Pure URL helpers for the SoundCloud path. Lives outside the
// Android-cfg-gated parts so it can be unit-tested on the
// desktop host without an emulator.

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

const KNOWN_HOSTS: &[&str] = &[
    "soundcloud.com",
    "www.soundcloud.com",
    "m.soundcloud.com",
    "on.soundcloud.com",
];

/// True if `url` looks like a SoundCloud track URL we should
/// route through the SC kernel rather than YouTube.
pub fn is_soundcloud_url(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    KNOWN_HOSTS
        .iter()
        .any(|h| lower.contains(&format!("://{h}/")) || lower.contains(&format!("://{h}?")))
}

/// True if `url` is a SoundCloud short-link served by
/// `on.soundcloud.com/<token>`. These are produced by the mobile
/// SC app's share sheet and have to be expanded via an HTTP
/// redirect before the resolve API will accept them.
pub fn is_short_url(url: &str) -> bool {
    url.trim()
        .to_lowercase()
        .contains("://on.soundcloud.com/")
}

/// Normalises a user-supplied URL into the canonical form SC's
/// resolve API expects. We strip query strings + fragments
/// because they confuse the resolver, and replace `m.` /
/// `www.` with the bare host.
///
/// Returns `None` if the URL doesn't look like SoundCloud at all.
pub fn canonicalise(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if !is_soundcloud_url(trimmed) {
        return None;
    }
    // Strip fragment + query
    let no_frag = trimmed.split_once('#').map(|(a, _)| a).unwrap_or(trimmed);
    let no_query = no_frag.split_once('?').map(|(a, _)| a).unwrap_or(no_frag);
    // Force apex host
    let canon = no_query
        .replacen("://m.soundcloud.com", "://soundcloud.com", 1)
        .replacen("://www.soundcloud.com", "://soundcloud.com", 1);
    Some(canon)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_canonical_url() {
        assert!(is_soundcloud_url("https://soundcloud.com/foo/bar"));
        assert!(is_soundcloud_url("https://www.soundcloud.com/foo/bar"));
        assert!(is_soundcloud_url("https://m.soundcloud.com/foo/bar"));
        assert!(is_soundcloud_url("https://on.soundcloud.com/abc"));
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(!is_soundcloud_url("https://soundcloud.example.com/x"));
        assert!(!is_soundcloud_url("https://example.com/soundcloud.com/x"));
        assert!(!is_soundcloud_url("https://www.youtube.com/watch?v=abc"));
        assert!(!is_soundcloud_url(""));
    }

    #[test]
    fn canonicalise_strips_query_and_fragment() {
        assert_eq!(
            canonicalise("https://soundcloud.com/foo/bar?utm_source=x#play"),
            Some("https://soundcloud.com/foo/bar".to_string()),
        );
    }

    #[test]
    fn canonicalise_normalises_subdomains() {
        assert_eq!(
            canonicalise("https://m.soundcloud.com/foo/bar"),
            Some("https://soundcloud.com/foo/bar".to_string()),
        );
        assert_eq!(
            canonicalise("https://www.soundcloud.com/foo/bar"),
            Some("https://soundcloud.com/foo/bar".to_string()),
        );
    }

    #[test]
    fn canonicalise_returns_none_for_non_soundcloud() {
        assert!(canonicalise("https://youtube.com/x").is_none());
        assert!(canonicalise("not a url").is_none());
    }

    #[test]
    fn canonicalise_trims_whitespace() {
        assert_eq!(
            canonicalise("  https://soundcloud.com/foo/bar  "),
            Some("https://soundcloud.com/foo/bar".to_string()),
        );
    }

    #[test]
    fn is_short_url_recognises_on_subdomain() {
        assert!(is_short_url("https://on.soundcloud.com/abc123"));
        assert!(is_short_url("HTTPS://ON.SOUNDCLOUD.COM/abc"));
    }

    #[test]
    fn is_short_url_rejects_canonical_links() {
        assert!(!is_short_url("https://soundcloud.com/user/track"));
        assert!(!is_short_url("https://www.soundcloud.com/x"));
        assert!(!is_short_url("https://m.soundcloud.com/x"));
        assert!(!is_short_url("https://youtube.com/watch?v=abc"));
    }
}
