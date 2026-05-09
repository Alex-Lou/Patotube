// Shared `MediaInfo` payload returned to the frontend. Lives in
// its own module so every kernel (YouTube / SoundCloud / Bandcamp /
// Audiomack / Internet Archive / yt-dlp) can import the same type
// without dragging in the desktop-only yt-dlp orchestration code
// (which would otherwise compile on Android, where it's unused).

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub url: String,
    pub title: String,
    pub uploader: Option<String>,
    pub duration_sec: Option<f64>,
    pub thumbnail: Option<String>,
    pub platform: String,
}
