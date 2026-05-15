#![allow(dead_code)]

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
    #[serde(default)]
    pub formats: Vec<Format>,
    #[serde(rename = "adaptiveFormats", default)]
    pub adaptive_formats: Vec<Format>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Format {
    /// Plain CDN URL — present from un-ciphered clients (ANDROID_MUSIC,
    /// ANDROID, IOS, TVHTML5). Stream directly.
    pub url: Option<String>,
    /// Encoded `s=…&sp=…&url=…` blob — present instead of `url` for
    /// ciphered clients (typically WEB). Run through `sigcipher::Unlocker`.
    #[serde(rename = "signatureCipher")]
    pub signature_cipher: Option<String>,
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
