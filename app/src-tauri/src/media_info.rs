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
