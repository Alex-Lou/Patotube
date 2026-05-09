// Pure URL / string helpers for the YouTube path. Lives outside the
// `youtube_kernel/` directory (which is cfg-gated to Android) so the
// helpers can be unit-tested on the desktop host without an emulator.
//
// On non-Android targets these functions are unused at runtime — the
// `dead_code` allow keeps the cargo output quiet there while letting
// `cargo test --lib` exercise them on any host.

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

/// Extract a video ID from any of the URL shapes YouTube serves:
///   https://www.youtube.com/watch?v=ID
///   https://youtu.be/ID
///   https://youtube.com/shorts/ID
///   https://www.youtube.com/embed/ID
///   https://m.youtube.com/v/ID
/// Returns `None` if the input doesn't look like a YouTube URL or the
/// ID portion is missing. The caller decides whether the trimmed ID
/// has the expected 11-char shape — we keep this layer permissive so
/// future ID changes don't silently break extraction.
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

/// Replace characters that confuse Windows/Android filesystems with
/// underscores, trim leading/trailing dots and whitespace, and cap to
/// 140 chars so the path stays under typical PATH_MAX. Pure; safe to
/// reuse from any platform.
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
