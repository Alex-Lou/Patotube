// Internet Archive URL helpers. The site's URL space is wide
// (collections, search results, full-text browser) but for our
// purposes only `/details/<identifier>` pages are downloadable
// items.

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

const IA_HOSTS: &[&str] = &["archive.org", "www.archive.org"];

/// True if `url` is an `archive.org/...` link, regardless of
/// whether it's a `/details/`, `/download/`, or other sub-path.
pub fn is_archive_url(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    IA_HOSTS
        .iter()
        .any(|h| lower.contains(&format!("://{h}/")) || lower.contains(&format!("://{h}?")))
}

/// Pull the IA item identifier out of an `/details/<id>` or
/// `/download/<id>/...` URL. Returns the identifier with no
/// trailing slash or query string.
pub fn extract_identifier(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if !is_archive_url(trimmed) {
        return None;
    }
    for prefix in ["/details/", "/download/", "/embed/"] {
        if let Some(idx) = trimmed.find(prefix) {
            let rest = &trimmed[idx + prefix.len()..];
            let id = rest.split(['/', '?', '#']).next()?;
            if !id.is_empty() {
                return Some(id.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_archive_urls() {
        assert!(is_archive_url("https://archive.org/details/foo"));
        assert!(is_archive_url("https://www.archive.org/download/bar/file.mp3"));
        assert!(is_archive_url("https://archive.org/embed/baz"));
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(!is_archive_url("https://archive.com/details/x"));
        assert!(!is_archive_url("https://web.archive.org/web/123/url"));
        assert!(!is_archive_url(""));
    }

    #[test]
    fn extracts_identifier_from_details() {
        assert_eq!(
            extract_identifier("https://archive.org/details/gd1977-05-08"),
            Some("gd1977-05-08".to_string()),
        );
    }

    #[test]
    fn extracts_identifier_from_download_with_filename() {
        assert_eq!(
            extract_identifier(
                "https://archive.org/download/gd1977-05-08/file.mp3"
            ),
            Some("gd1977-05-08".to_string()),
        );
    }

    #[test]
    fn extracts_identifier_from_embed() {
        assert_eq!(
            extract_identifier("https://archive.org/embed/some-item-2024"),
            Some("some-item-2024".to_string()),
        );
    }

    #[test]
    fn strips_query_and_fragment() {
        assert_eq!(
            extract_identifier(
                "https://archive.org/details/foo?start=10#play"
            ),
            Some("foo".to_string()),
        );
    }

    #[test]
    fn returns_none_for_root_pages() {
        assert!(extract_identifier("https://archive.org/").is_none());
        assert!(extract_identifier("https://archive.org/about").is_none());
    }
}
