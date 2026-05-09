// Resolves the on-disk write path for a download.
//
// On Android, the user-requested output_dir is generally
// meaningless — Tauri's `download_dir()` returns paths the app
// can't actually write to thanks to scoped storage. We probe a
// fixed list of known-writable candidates instead.
//
// On desktop, the user-supplied output_dir is the truth — the OS
// download folder, or a custom one the user picked. We just
// ensure the dir exists and append the filename.
//
// `resolve_destination` is the cross-platform entry point. The
// android-specific candidate-probe lives behind it.

#![allow(dead_code)]

use std::path::PathBuf;

/// Build the final on-disk path a kernel should stream into.
///
/// `preferred_dir` is the user-supplied output dir (the OS
/// downloads folder, or a custom one set in settings). It's
/// honoured on desktop and ignored on Android (where we have to
/// probe writable locations because of scoped storage).
pub async fn resolve_destination(
    preferred_dir: &str,
    filename: &str,
) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        // The frontend passes Tauri's download_dir on Android, but
        // it's a path under /storage/... that scoped storage often
        // refuses. Walk our known-writable candidates instead.
        let _ = preferred_dir;
        resolve_android_candidate(filename).await
    }
    #[cfg(not(target_os = "android"))]
    {
        let dir = PathBuf::from(preferred_dir);
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| format!("could not create output dir {preferred_dir:?}: {e}"))?;
        Ok(dir.join(filename))
    }
}

#[cfg(target_os = "android")]
const CANDIDATE_DIRS: &[&str] = &[
    // Primary: ROOT of public /sdcard/Download. We save files at
    // the very root (no Patotube subfolder) so every Android file
    // manager picks them up in the default "Downloads" view —
    // Xiaomi, Samsung, Google Files, etc. all hide subfolders
    // from that view.
    "/storage/emulated/0/Download",
    // Fallback: app-external. Always writable, always visible
    // through Internal storage → Android → data → io.patotube.app
    // → files → Download.
    "/storage/emulated/0/Android/data/io.patotube.app/files/Download",
    // Last-resort: app-private internal. Hidden from file managers
    // but unconditionally writable.
    "/data/data/io.patotube.app/files/Download",
];

/// Android-only: probe each candidate by attempting to create + delete
/// the EXACT filename the caller wants. A previous version probed a
/// hidden ".patotube-probe" marker, but Android 13+'s scoped storage
/// sometimes accepts dotfile writes in /sdcard/Download while
/// rejecting regular file creates — which made the probe a false
/// positive and left the actual download to die with a confusing
/// EACCES.
///
/// The package name `io.patotube.app` must stay in sync with
/// `tauri.conf.json` identifier — it's compiled into Android's app
/// data paths.
#[cfg(target_os = "android")]
async fn resolve_android_candidate(filename: &str) -> Result<PathBuf, String> {
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
