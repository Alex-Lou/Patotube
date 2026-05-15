#![allow(dead_code)]

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
    pub url: String,
    pub preset: Option<String>,
    pub format: TranscodingFormat,
    pub quality: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TranscodingFormat {
    /// `progressive` (single HTTPS GET → real .mp3) or `hls`
    /// (m3u8 playlist). We always pick progressive — no HLS muxing.
    pub protocol: String,
    pub mime_type: String,
}

#[derive(Debug, Deserialize)]
pub struct StreamRedirect {
    pub url: String,
}
