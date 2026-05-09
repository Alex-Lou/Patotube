// Audiomack URL helpers. Modern URLs are
// `audiomack.com/<artist>/song/<track-slug>`; the API endpoint
// expects the slug pair WITHOUT the `/song/` separator (it uses
// `<artist>/<track-slug>` as the path component).

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

const HOSTS: &[&str] = &["audiomack.com", "www.audiomack.com"];

/// True if `url` looks like an Audiomack track / song URL.
pub fn is_audiomack_url(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    HOSTS
        .iter()
        .any(|h| lower.contains(&format!("://{h}/")) || lower.contains(&format!("://{h}?")))
}

/// True if `url` specifically references a single song (vs an
/// album, profile, playlist).
pub fn is_audiomack_song_url(url: &str) -> bool {
    is_audiomack_url(url) && url.to_lowercase().contains("/song/")
}

/// Extract the API path the metadata endpoint wants:
/// `<artist>/<track-slug>` (no `/song/` infix). Returns None
/// when the URL doesn't look like a song page.
pub fn extract_api_path(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if !is_audiomack_song_url(trimmed) {
        return None;
    }
    // Locate the host then peel the path.
    let after_host = trimmed
        .splitn(2, "audiomack.com/")
        .nth(1)?
        .trim_start_matches("www.");
    let path_only = after_host.split(['?', '#']).next()?;
    // Drop the `/song/` infix; we end up with `<artist>/<slug>`.
    let cleaned = path_only.replacen("/song/", "/", 1);
    // Trim any trailing slashes.
    let cleaned = cleaned.trim_end_matches('/').to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_song_urls() {
        assert!(is_audiomack_url("https://audiomack.com/artist/song/title"));
        assert!(is_audiomack_song_url(
            "https://audiomack.com/artist/song/title"
        ));
        assert!(is_audiomack_song_url(
            "https://www.audiomack.com/artist/song/title"
        ));
    }

    #[test]
    fn distinguishes_song_from_other_pages() {
        assert!(is_audiomack_url("https://audiomack.com/artist/album/x"));
        assert!(!is_audiomack_song_url(
            "https://audiomack.com/artist/album/x"
        ));
    }

    #[test]
    fn extracts_api_path_for_modern_song_url() {
        assert_eq!(
            extract_api_path("https://audiomack.com/some-artist/song/cool-track"),
            Some("some-artist/cool-track".to_string()),
        );
    }

    #[test]
    fn extract_api_path_strips_query_and_fragment() {
        assert_eq!(
            extract_api_path(
                "https://audiomack.com/artist/song/title?utm_src=x#play"
            ),
            Some("artist/title".to_string()),
        );
    }

    #[test]
    fn extract_api_path_strips_trailing_slash() {
        assert_eq!(
            extract_api_path("https://audiomack.com/artist/song/title/"),
            Some("artist/title".to_string()),
        );
    }

    #[test]
    fn extract_api_path_returns_none_for_non_song() {
        assert!(extract_api_path("https://audiomack.com/artist/album/x").is_none());
        assert!(extract_api_path("https://soundcloud.com/x/y").is_none());
    }
}
