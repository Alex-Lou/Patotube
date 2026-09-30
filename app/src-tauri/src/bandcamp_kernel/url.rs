#![allow(dead_code)]

pub fn is_bandcamp_url(url: &str) -> bool {
    crate::url_guard::http_host(url).is_some_and(|h| h.ends_with(".bandcamp.com"))
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
    fn rejects_bandcamp_lookalikes_on_other_hosts() {
        assert!(!is_bandcamp_url("http://127.0.0.1/x.bandcamp.com"));
        assert!(!is_bandcamp_url("https://evil.com/?a=.bandcamp.com"));
        assert!(!is_bandcamp_url("https://bandcamp.com.evil.com/track/x"));
    }

    #[test]
    fn case_insensitive() {
        assert!(is_bandcamp_track_url(
            "HTTPS://Artist.BANDCAMP.com/Track/Song"
        ));
    }
}
