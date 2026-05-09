#![allow(dead_code)]

// Serde shapes for Internet Archive's `/metadata/<id>` JSON. Only
// the fields we actually consume are deserialised; IA returns a
// LOT more (review counts, file checksums, derivation lineage…).

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ItemMetadata {
    pub metadata: ItemDetails,
    #[serde(default)]
    pub files: Vec<ItemFile>,
}

#[derive(Debug, Deserialize)]
pub struct ItemDetails {
    pub identifier: String,
    /// Item title — sometimes a string, sometimes a single-element
    /// array (IA quirk for items with multiple titles), so we
    /// accept both via `serde(untagged)`.
    pub title: Option<StringOrList>,
    /// Often a single string, sometimes an array (multiple authors).
    pub creator: Option<StringOrList>,
    /// `audio`, `movies`, `texts`, `software`, `image`, etc.
    pub mediatype: Option<String>,
}

/// IA returns single-element fields as either `"x"` or `["x"]`
/// inconsistently. This sidesteps the choice.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum StringOrList {
    Single(String),
    Many(Vec<String>),
}

impl StringOrList {
    pub fn into_string(self) -> Option<String> {
        match self {
            StringOrList::Single(s) => Some(s),
            StringOrList::Many(v) => v.into_iter().next(),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct ItemFile {
    pub name: String,
    /// IA's human-readable format label, e.g. `"VBR MP3"`,
    /// `"Flac"`, `"h.264"`, `"Ogg Vorbis"`.
    pub format: Option<String>,
    /// Length in seconds. Returned as a string by IA so we
    /// parse it on demand.
    pub length: Option<String>,
    /// File size in bytes. Same: string in JSON.
    pub size: Option<String>,
}
