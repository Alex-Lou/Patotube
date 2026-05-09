#![allow(dead_code)]

// Resolves the on-disk write path for a download. Android storage
// is layered: public Downloads is the most user-friendly but gated
// behind scoped storage on Android 11+; the app-external dir
// always works but lives under a deep "Internal storage / Android /
// data / ..." tree most file managers hide; the app-private
// internal dir is the unconditional last resort.
//
// We probe each candidate by attempting to create + delete the
// EXACT filename the caller wants to use. A previous version
// used a hidden ".patotube-probe" marker, but Android 13+'s
// scoped storage sometimes accepts dotfile writes in
// /sdcard/Download while rejecting regular file creates — which
// made the probe a false positive and left the actual download
// to die with a confusing EACCES.
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

pub async fn resolve_output_path(filename: &str) -> Result<PathBuf, String> {
    let mut last_err: Option<String> = None;
    for dir in CANDIDATE_DIRS {
        let p = PathBuf::from(dir);
        if let Err(e) = tokio::fs::create_dir_all(&p).await {
            eprintln!("[patotube] output_path: mkdir failed for {dir}: {e}");
            last_err = Some(format!("{dir}: mkdir: {e}"));
            continue;
        }
        let target = p.join(filename);
        match tokio::fs::File::create(&target).await {
            Ok(_) => {
                // Drop the empty placeholder; the streamer will
                // re-create it for the actual write. The race
                // window between this drop and the next create is
                // microscopic and same-uid, so it's fine.
                let _ = tokio::fs::remove_file(&target).await;
                eprintln!(
                    "[patotube] output_path: chose {} (probe of real filename succeeded)",
                    target.display()
                );
                return Ok(target);
            }
            Err(e) => {
                eprintln!(
                    "[patotube] output_path: probe create failed at {}: {e}",
                    target.display()
                );
                last_err = Some(format!("{dir}: create: {e}"));
            }
        }
    }
    Err(format!(
        "No writable download folder. Last error: {}",
        last_err.unwrap_or_else(|| "none".into())
    ))
}
