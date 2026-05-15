#![cfg_attr(not(target_os = "android"), allow(dead_code))]

/// Extract a video ID from watch/youtu.be/shorts/embed/v URLs.
/// Permissive: caller validates the ID shape if needed.
pub fn extract_youtube_id(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if let Some(rest) = trimmed
        .strip_prefix("https://youtu.be/")
        .or_else(|| trimmed.strip_prefix("http://youtu.be/"))
    {
        let id = rest.split(['/', '?', '#']).next()?;
        return non_empty(id);
    }

    let lower = trimmed.to_lowercase();
    if lower.contains("youtube.com") {
        if let Some(idx) = trimmed.find("v=") {
            let rest = &trimmed[idx + 2..];
            let id = rest.split(['&', '#']).next()?;
            return non_empty(id);
        }
        for prefix in ["/shorts/", "/embed/", "/v/"] {
            if let Some(idx) = trimmed.find(prefix) {
                let rest = &trimmed[idx + prefix.len()..];
                let id = rest.split(['/', '?', '#']).next()?;
                return non_empty(id);
            }
        }
    }
    None
}

fn non_empty(s: &str) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

/// Sanitize for Windows/Android FS, trim leading/trailing dots+spaces, cap at 140 chars (PATH_MAX safety).
pub fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    cleaned
        .trim_matches(|c: char| c == '.' || c.is_whitespace())
        .chars()
        .take(140)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_id_from_watch_url() {
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn extracts_id_from_watch_url_with_extra_params() {
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=RD"),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn extracts_id_from_short_youtu_be_url() {
        assert_eq!(
            extract_youtube_id("https://youtu.be/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string()),
        );
        assert_eq!(
            extract_youtube_id("https://youtu.be/dQw4w9WgXcQ?t=10"),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn extracts_id_from_shorts_url() {
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/shorts/abc-123_xy"),
            Some("abc-123_xy".to_string()),
        );
    }

    #[test]
    fn extracts_id_from_embed_url() {
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn extracts_id_from_mobile_url() {
        assert_eq!(
            extract_youtube_id("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn extracts_id_with_leading_whitespace() {
        assert_eq!(
            extract_youtube_id("  https://www.youtube.com/watch?v=dQw4w9WgXcQ  "),
            Some("dQw4w9WgXcQ".to_string()),
        );
    }

    #[test]
    fn rejects_non_youtube_urls() {
        assert_eq!(extract_youtube_id("https://vimeo.com/12345"), None);
        assert_eq!(extract_youtube_id("not a url at all"), None);
        assert_eq!(extract_youtube_id(""), None);
    }

    #[test]
    fn rejects_empty_id_after_prefix() {
        assert_eq!(extract_youtube_id("https://youtu.be/"), None);
        assert_eq!(extract_youtube_id("https://www.youtube.com/watch?v="), None);
    }

    #[test]
    fn sanitize_filename_replaces_path_separators() {
        assert_eq!(sanitize_filename("a/b\\c:d"), "a_b_c_d");
    }

    #[test]
    fn sanitize_filename_replaces_windows_reserved_chars() {
        assert_eq!(sanitize_filename(r#"foo*?"<>|bar"#), "foo______bar");
    }

    #[test]
    fn sanitize_filename_strips_leading_trailing_dots_and_spaces() {
        assert_eq!(sanitize_filename("  .hidden file.  "), "hidden file");
        assert_eq!(sanitize_filename("..."), "");
    }

    #[test]
    fn sanitize_filename_caps_length() {
        let long = "a".repeat(500);
        let out = sanitize_filename(&long);
        assert_eq!(out.chars().count(), 140);
    }

    #[test]
    fn sanitize_filename_replaces_control_chars() {
        assert_eq!(sanitize_filename("foo\nbar\tbaz"), "foo_bar_baz");
    }

    #[test]
    fn sanitize_filename_preserves_unicode() {
        // Quirky title with emoji and accents — common YouTube content.
        let out = sanitize_filename("Café — naïve résumé 🎵");
        assert_eq!(out, "Café — naïve résumé 🎵");
    }
}
