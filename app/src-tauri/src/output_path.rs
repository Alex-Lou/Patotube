// Resolves the on-disk write path for a download.
//
// On desktop the user-supplied output_dir IS the truth — Tauri's
// `download_dir()` returns the OS Downloads folder, or a custom
// path the user picked in settings. We just ensure it exists and
// append the filename.
//
// On Android scoped storage rules mean the user-requested
// download_dir is often un-writable. We instead return a
// fallback chain — the streamer tries each candidate in order
// until `File::create` succeeds. We deliberately DON'T probe
// each candidate first because Android 13+'s scoped storage
// sometimes accepts a probe create + delete + re-create as
// "first write succeeded, second blocked" (MediaStore caches
// the deletion). One create attempt per candidate, no probe.

#![allow(dead_code)]

use std::path::PathBuf;

/// Build the full list of candidate paths a kernel can stream
/// into. Streamer tries each in order until one accepts the
/// File::create. The Vec is non-empty as long as `preferred_dir`
/// is.
///
/// `preferred_dir` is the user-supplied output dir (the OS
/// downloads folder, or a custom one set in settings). Honoured
/// on desktop; supplemented (not replaced) on Android by
/// known-writable fallbacks for when scoped storage refuses the
/// preferred path.
pub async fn destination_candidates(
    preferred_dir: &str,
    filename: &str,
) -> Result<Vec<PathBuf>, String> {
    #[cfg(target_os = "android")]
    {
        let _ = preferred_dir;
        Ok(android_candidates(filename).await)
    }
    #[cfg(not(target_os = "android"))]
    {
        let dir = PathBuf::from(preferred_dir);
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| format!("could not create output dir {preferred_dir:?}: {e}"))?;
        Ok(vec![dir.join(filename)])
    }
}

#[cfg(target_os = "android")]
const ANDROID_CANDIDATE_DIRS: &[&str] = &[
    // Primary: ROOT of public /sdcard/Download. Visible under
    // "Downloads" in every Android file manager.
    "/storage/emulated/0/Download",
    // Fallback: app-external. Always writable, visible through
    // Internal storage → Android → data → io.patotube.app →
    // files → Download.
    "/storage/emulated/0/Android/data/io.patotube.app/files/Download",
    // Last-resort: app-private internal. Hidden from file
    // managers but unconditionally writable.
    "/data/data/io.patotube.app/files/Download",
];

/// Android-only: build the candidate list. We `mkdir -p` each
/// candidate (no penalty if it already exists) but don't probe
/// — the streamer attempts File::create on each in turn,
/// accepting whichever succeeds first.
#[cfg(target_os = "android")]
async fn android_candidates(filename: &str) -> Vec<PathBuf> {
    let mut out = Vec::with_capacity(ANDROID_CANDIDATE_DIRS.len());
    for dir in ANDROID_CANDIDATE_DIRS {
        let p = PathBuf::from(dir);
        // Ignore mkdir errors — File::create will surface them
        // again per-candidate with a clearer error.
        if let Err(e) = tokio::fs::create_dir_all(&p).await {
            eprintln!("[patotube] output_path: mkdir {dir} failed: {e}");
            // Still add the path; create might still succeed if
            // the dir already exists from a previous run.
        }
        out.push(p.join(filename));
    }
    out
}
