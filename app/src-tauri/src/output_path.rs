#![allow(dead_code)]

// Resolves the on-disk write path for a download. Android storage
// is layered: public Downloads is the most user-friendly but gated
// behind scoped storage on Android 11+; the app-external dir
// always works but lives under a deep "Internal storage / Android /
// data / ..." tree most file managers hide; the app-private
// internal dir is the unconditional last resort.
//
// We probe each candidate by writing then deleting a tiny marker
// file, falling through to the next on any failure. The first
// candidate that accepts the write becomes the chosen output dir.
//
// The package name `io.patotube.app` must stay in sync with
// `tauri.conf.json` identifier — it's compiled into Android's app
// data paths.

use std::path::PathBuf;

const CANDIDATE_DIRS: &[&str] = &[
    // Primary: ROOT of public /sdcard/Download. We save files at
    // the very root (no Patotube subfolder) so every Android file
    // manager picks them up in the default "Downloads" view —
    // Xiaomi, Samsung, Google Files, etc. all hide subfolders from
    // that view.
    "/storage/emulated/0/Download",
    // Fallback: app-external. Always writable, always visible
    // through Internal storage → Android → data → io.patotube.app
    // → files → Download.
    "/storage/emulated/0/Android/data/io.patotube.app/files/Download",
    // Last-resort: app-private internal. Hidden from file managers
    // but unconditionally writable.
    "/data/data/io.patotube.app/files/Download",
];

const PROBE_FILENAME: &str = ".patotube-probe";

pub async fn resolve_output_path(filename: &str) -> Result<PathBuf, String> {
    let mut last_err: Option<String> = None;
    for dir in CANDIDATE_DIRS {
        let p = PathBuf::from(dir);
        if let Err(e) = tokio::fs::create_dir_all(&p).await {
            last_err = Some(format!("{dir}: {e}"));
            continue;
        }
        let probe = p.join(PROBE_FILENAME);
        match tokio::fs::write(&probe, b"probe").await {
            Ok(()) => {
                let _ = tokio::fs::remove_file(&probe).await;
                return Ok(p.join(filename));
            }
            Err(e) => {
                last_err = Some(format!("{dir}: {e}"));
            }
        }
    }
    Err(format!(
        "No writable download folder. Last error: {}",
        last_err.unwrap_or_else(|| "none".into())
    ))
}
