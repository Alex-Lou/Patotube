// Pure URL helpers for Bandcamp. Lives outside the Android-cfg-
// gated parts so unit tests run on the desktop host.
//
// `is_bandcamp_track_url` is currently only consumed by the unit
// tests below — we keep it as a public helper for future
// album/playlist routing — so dead-code is silenced at the file
// level rather than per-target-cfg.

#![allow(dead_code)]

/// True if the URL points at any `*.bandcamp.com` host.
///
/// We were previously requiring the trailing `/` after the host,
/// which mis-rejected URLs like `https://artist.bandcamp.com`
/// (no path) — typical of mobile share-sheet links. The new check
/// only requires the `.bandcamp.com` host substring; the kernel's
/// page fetch will deal with the missing path naturally.
pub fn is_bandcamp_url(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    lower.contains(".bandcamp.com")
}

/// True if the URL specifically references a track (vs an album,
/// merch page, profile, etc.). Album support could be added later
/// by walking `trackinfo[]` rather than just picking [0].
pub fn is_bandcamp_track_url(url: &str) -> bool {
    is_bandcamp_url(url) && url.to_lowercase().contains("/track/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_track_url() {
        assert!(is_bandcamp_url(
            "https://artist.bandcamp.com/track/song-title"
        ));
        assert!(is_bandcamp_track_url(
            "https://artist.bandcamp.com/track/song-title"
        ));
    }

    #[test]
    fn detects_subdomain_album_as_bandcamp_but_not_track() {
        let url = "https://artist.bandcamp.com/album/album-title";
        assert!(is_bandcamp_url(url));
        assert!(!is_bandcamp_track_url(url));
    }

    #[test]
    fn rejects_non_bandcamp() {
        assert!(!is_bandcamp_url("https://soundcloud.com/x/y"));
        assert!(!is_bandcamp_url(""));
    }

    #[test]
    fn detects_url_without_trailing_slash() {
        // Mobile share sheets often emit the bare host with no
        // trailing slash. The previous regex rejected these.
        assert!(is_bandcamp_url("https://artist.bandcamp.com"));
    }

    #[test]
    fn case_insensitive() {
        assert!(is_bandcamp_track_url(
            "HTTPS://Artist.BANDCAMP.com/Track/Song"
        ));
    }
}
