// Mini file manager — used on Android where no system app exists. Works on desktop too.

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    /// Negative or 0 means the FS didn't expose a modified time — sort it last.
    pub mtime: i64,
    pub mime_kind: String,
}

fn classify(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "mp3" | "m4a" | "ogg" | "opus" | "flac" | "wav" | "aac" => Some("audio"),
        "mp4" | "mkv" | "webm" => Some("video"),
        _ => None,
    }
}

/// True for an existing regular file with an audio/video extension
/// Patotube produces. Used to keep WebView-reachable commands from
/// touching anything else (executables, documents, …).
pub fn is_media_file(path: &Path) -> bool {
    let ext_ok = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| classify(e).is_some());
    ext_ok && path.is_file()
}

async fn collect_dir(dir: &Path, out: &mut Vec<DownloadEntry>) {
    let mut rd = match tokio::fs::read_dir(dir).await {
        Ok(r) => r,
        Err(_) => return,
    };
    while let Ok(Some(entry)) = rd.next_entry().await {
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let kind = match classify(&ext) {
            Some(k) => k,
            None => continue,
        };
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        out.push(DownloadEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            size: meta.len(),
            mtime,
            mime_kind: kind.to_string(),
        });
    }
}

fn scan_dirs(app: &AppHandle) -> Vec<PathBuf> {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        vec![
            PathBuf::from("/storage/emulated/0/Download"),
            PathBuf::from("/storage/emulated/0/Android/data/io.patotube.app/files/Download"),
            PathBuf::from("/data/data/io.patotube.app/files/Download"),
        ]
    }
    #[cfg(not(target_os = "android"))]
    {
        match app.path().download_dir() {
            Ok(p) => vec![p],
            Err(_) => Vec::new(),
        }
    }
}

#[tauri::command]
pub async fn list_downloads(app: AppHandle) -> Result<Vec<DownloadEntry>, String> {
    let dirs = scan_dirs(&app);
    let mut all = Vec::new();
    for dir in dirs {
        collect_dir(&dir, &mut all).await;
    }
    // De-dupe by absolute path (Android candidates can overlap via symlinks on some ROMs).
    all.sort_by(|a, b| a.path.cmp(&b.path));
    all.dedup_by(|a, b| a.path == b.path);
    all.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    Ok(all)
}

#[tauri::command]
pub async fn delete_download(app: AppHandle, path: String) -> Result<(), String> {
    // Restrict deletes to listed dirs; canonicalize resolves symlinks/`..` to defeat escapes.
    let target = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("could not canonicalise {path:?}: {e}"))?;
    let allowed_roots: Vec<PathBuf> = scan_dirs(&app)
        .into_iter()
        .filter_map(|p| p.canonicalize().ok())
        .collect();
    if !allowed_roots.iter().any(|root| target.starts_with(root)) {
        return Err("path is outside the downloads tree".to_string());
    }
    if !is_media_file(&target) {
        return Err("refusing to delete a non-media file".to_string());
    }
    tokio::fs::remove_file(&target)
        .await
        .map_err(|e| format!("could not delete {target:?}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_known_media_extensions() {
        assert_eq!(classify("MP3"), Some("audio"));
        assert_eq!(classify("mp4"), Some("video"));
        assert_eq!(classify("exe"), None);
        assert_eq!(classify(""), None);
    }

    #[test]
    fn is_media_file_requires_existing_media_file() {
        let dir = std::env::temp_dir().join(format!("patotube-files-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let song = dir.join("song.mp3");
        let script = dir.join("run.sh");
        std::fs::write(&song, b"x").unwrap();
        std::fs::write(&script, b"x").unwrap();

        assert!(is_media_file(&song));
        assert!(!is_media_file(&script));
        assert!(!is_media_file(&dir.join("missing.mp3")));
        assert!(!is_media_file(&dir)); // directory, not a file

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
