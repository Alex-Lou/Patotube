#![allow(dead_code)]

pub fn is_bandcamp_url(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    lower.contains(".bandcamp.com")
}

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
        assert!(is_bandcamp_url("https://artist.bandcamp.com"));
    }

    #[test]
    fn case_insensitive() {
        assert!(is_bandcamp_track_url(
            "HTTPS://Artist.BANDCAMP.com/Track/Song"
        ));
    }
}
