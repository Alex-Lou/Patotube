// Serde shapes for the youtubei/v1/player JSON response. These cover
// only the fields we actually read; YouTube returns dozens more we
// happily ignore via Serde's default skip-unknown behaviour.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct PlayerResponse {
    #[serde(rename = "videoDetails")]
    pub video_details: Option<VideoDetails>,
    #[serde(rename = "streamingData")]
    pub streaming_data: Option<StreamingData>,
    #[serde(rename = "playabilityStatus")]
    pub playability_status: Option<PlayabilityStatus>,
}

#[derive(Debug, Deserialize)]
pub struct VideoDetails {
    #[serde(rename = "videoId")]
    pub video_id: String,
    pub title: String,
    #[serde(rename = "lengthSeconds", default)]
    pub length_seconds: String,
    pub author: Option<String>,
    pub thumbnail: Option<ThumbnailContainer>,
}

#[derive(Debug, Deserialize)]
pub struct ThumbnailContainer {
    pub thumbnails: Vec<Thumbnail>,
}

#[derive(Debug, Deserialize)]
pub struct Thumbnail {
    pub url: String,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
}

#[derive(Debug, Deserialize)]
pub struct StreamingData {
    /// Combined audio+video formats (legacy `formats` field). Always
    /// have a direct `url` we can stream from.
    #[serde(default)]
    pub formats: Vec<Format>,
    /// DASH-style separate audio / video streams. Where most of the
    /// per-codec, per-bitrate options live.
    #[serde(rename = "adaptiveFormats", default)]
    pub adaptive_formats: Vec<Format>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Format {
    pub url: Option<String>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub height: u32,
    #[serde(rename = "contentLength")]
    pub content_length: Option<String>,
    #[serde(rename = "averageBitrate")]
    pub average_bitrate: Option<u64>,
    #[serde(rename = "audioQuality")]
    pub audio_quality: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PlayabilityStatus {
    pub status: Option<String>,
    pub reason: Option<String>,
}
