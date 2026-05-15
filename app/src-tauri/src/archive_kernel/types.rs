#![allow(dead_code)]

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
    pub title: Option<StringOrList>,
    pub creator: Option<StringOrList>,
    pub mediatype: Option<String>,
}

/// IA returns single-element fields as either `"x"` or `["x"]`
/// inconsistently — accept both via `serde(untagged)`.
#[derive(Debug, Clone, Deserialize)]
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
    pub format: Option<String>,
    pub length: Option<String>,
    pub size: Option<String>,
}
