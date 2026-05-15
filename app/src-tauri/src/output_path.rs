// We deliberately DON'T probe each candidate first: Android 13+ scoped storage
// sometimes treats a probe create + delete + re-create as "first write succeeded,
// second blocked" (MediaStore caches the deletion). One create attempt per
// candidate, no probe.

#![allow(dead_code)]

use std::path::PathBuf;

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

#[cfg(target_os = "android")]
async fn android_candidates(filename: &str) -> Vec<PathBuf> {
    let mut out = Vec::with_capacity(ANDROID_CANDIDATE_DIRS.len());
    for dir in ANDROID_CANDIDATE_DIRS {
        let p = PathBuf::from(dir);
        if let Err(e) = tokio::fs::create_dir_all(&p).await {
            eprintln!("[patotube] output_path: mkdir {dir} failed: {e}");
        }
        out.push(p.join(filename));
    }
    out
}
