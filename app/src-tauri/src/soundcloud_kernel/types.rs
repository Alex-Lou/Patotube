#![allow(dead_code)]

// Serde shapes for SoundCloud's `api-v2.soundcloud.com/resolve`
// response. We only deserialise the fields we need; SC returns
// dozens more.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Track {
    pub id: u64,
    pub title: String,
    #[serde(default)]
    pub duration: u64, // milliseconds
    pub artwork_url: Option<String>,
    pub user: TrackUser,
    pub media: Media,
    /// `track`, `playlist`, etc. We only handle `track`.
    pub kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrackUser {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct Media {
    #[serde(default)]
    pub transcodings: Vec<Transcoding>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Transcoding {
    /// URL of the format-info endpoint. Has to be hit (with
    /// `?client_id=…`) to get the actual streamable URL.
    pub url: String,
    /// e.g. `mp3_1_0`, `mp3_standard`, `aac_1_0`. Used to pick
    /// the highest-quality option.
    pub preset: Option<String>,
    pub format: TranscodingFormat,
    /// `low`, `sq`, `hq`. SC reserves `hq` for paying users.
    pub quality: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TranscodingFormat {
    /// `progressive` (single HTTPS GET → real .mp3) or `hls`
    /// (m3u8 playlist, requires segment muxing). We always
    /// pick `progressive` so the pure-Rust streamer can
    /// download the file in one shot.
    pub protocol: String,
    /// e.g. `audio/mpeg`, `audio/mp4`, `audio/ogg`.
    pub mime_type: String,
}

/// Wraps the `{ url: "..." }` response from a transcoding's
/// resolve endpoint. The url here is the real CDN one we GET.
#[derive(Debug, Deserialize)]
pub struct StreamRedirect {
    pub url: String,
}
