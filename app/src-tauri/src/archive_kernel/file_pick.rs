// Picks the best file out of an Internet Archive item's `files[]`
// list. Items often ship the same content in 3-5 formats (the
// "derivative" pipeline auto-creates lower-quality copies for
// streaming). We pick a sensible default per item type:
//
//   - audio items → MP3 (universal), then Ogg, then Flac (if the
//     user wants lossless they should probably grab via the
//     web UI to choose explicitly).
//   - video items → MP4 (universal), then OGV, then any other.

#![allow(dead_code)]

use super::types::{ItemFile, ItemMetadata};

#[derive(Debug, Clone)]
pub struct PickedFile {
    pub name: String,
    /// File extension to save under, derived from `name`.
    pub extension: String,
}

/// Pick the best downloadable file for an item. The mediatype
/// drives whether we prefer audio or video formats; "texts" /
/// "software" / etc. fall through to "any file".
pub fn pick_best(item: &ItemMetadata) -> Result<PickedFile, String> {
    let mediatype = item.metadata.mediatype.as_deref().unwrap_or("");
    let chosen = match mediatype {
        "audio" => pick_audio(&item.files),
        "movies" => pick_video(&item.files),
        _ => pick_audio(&item.files).or_else(|| pick_video(&item.files)),
    }
    .or_else(|| item.files.first().cloned())
    .ok_or_else(|| "Internet Archive item has no files".to_string())?;

    let extension = file_extension(&chosen.name).to_string();
    Ok(PickedFile {
        name: chosen.name,
        extension,
    })
}

fn pick_audio(files: &[ItemFile]) -> Option<ItemFile> {
    pick_by_extension(files, &["mp3", "ogg", "flac", "wav", "m4a"])
}

fn pick_video(files: &[ItemFile]) -> Option<ItemFile> {
    pick_by_extension(files, &["mp4", "m4v", "ogv", "webm", "mkv", "avi", "mpeg"])
}

/// Return the first file whose extension matches `wanted`, in the
/// order given (preferred extensions first).
fn pick_by_extension(files: &[ItemFile], wanted: &[&str]) -> Option<ItemFile> {
    for ext in wanted {
        if let Some(f) = files
            .iter()
            .find(|f| file_extension(&f.name).eq_ignore_ascii_case(ext))
        {
            return Some(f.clone());
        }
    }
    None
}

fn file_extension(name: &str) -> &str {
    name.rsplit_once('.').map(|(_, e)| e).unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive_kernel::types::*;

    fn file(name: &str, format: &str) -> ItemFile {
        ItemFile {
            name: name.to_string(),
            format: Some(format.to_string()),
            length: None,
            size: None,
        }
    }

    fn item(mediatype: &str, files: Vec<ItemFile>) -> ItemMetadata {
        ItemMetadata {
            metadata: ItemDetails {
                identifier: "test".into(),
                title: Some(StringOrList::Single("t".into())),
                creator: None,
                mediatype: Some(mediatype.into()),
            },
            files,
        }
    }

    #[test]
    fn audio_item_prefers_mp3() {
        let it = item(
            "audio",
            vec![
                file("track.flac", "Flac"),
                file("track.ogg", "Ogg Vorbis"),
                file("track.mp3", "VBR MP3"),
            ],
        );
        let p = pick_best(&it).unwrap();
        assert_eq!(p.name, "track.mp3");
        assert_eq!(p.extension, "mp3");
    }

    #[test]
    fn audio_item_falls_back_to_ogg_when_no_mp3() {
        let it = item(
            "audio",
            vec![
                file("track.flac", "Flac"),
                file("track.ogg", "Ogg Vorbis"),
            ],
        );
        let p = pick_best(&it).unwrap();
        assert_eq!(p.name, "track.ogg");
    }

    #[test]
    fn movies_item_prefers_mp4() {
        let it = item(
            "movies",
            vec![
                file("movie.ogv", "Ogg Video"),
                file("movie.mp4", "h.264"),
                file("movie.mkv", "Matroska"),
            ],
        );
        let p = pick_best(&it).unwrap();
        assert_eq!(p.name, "movie.mp4");
        assert_eq!(p.extension, "mp4");
    }

    #[test]
    fn unknown_mediatype_tries_audio_then_video() {
        let it = item(
            "texts",
            vec![file("scan.pdf", "PDF"), file("audio.mp3", "VBR MP3")],
        );
        let p = pick_best(&it).unwrap();
        assert_eq!(p.name, "audio.mp3");
    }

    #[test]
    fn falls_back_to_first_file_when_nothing_matches() {
        let it = item(
            "texts",
            vec![file("scan.pdf", "PDF"), file("metadata.xml", "XML")],
        );
        let p = pick_best(&it).unwrap();
        assert_eq!(p.name, "scan.pdf");
        assert_eq!(p.extension, "pdf");
    }

    #[test]
    fn errors_when_files_array_is_empty() {
        let it = item("audio", vec![]);
        match pick_best(&it) {
            Ok(_) => panic!("expected error"),
            Err(e) => assert!(e.contains("no files"), "got: {e}"),
        }
    }
}
