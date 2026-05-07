// Used at runtime only on Android, but compiled everywhere so the
// pure-Rust submodules (sigcipher etc.) and their tests can build
// on the desktop host.
#![allow(dead_code)]

// YouTube client profiles. Each profile mimics a real YouTube
// binary's identification headers when calling youtubei/v1/player —
// the API serves different stream sets and applies different CDN
// restrictions per client name+version pair.
//
// =============================================================
// SECURITY NOTE — re: GitGuardian / "Google API key" findings
// =============================================================
// The four `AIzaSy...` strings below are NOT secrets. They are
// YouTube's own public client identifiers, hardcoded into every
// official YouTube binary (web, iOS, Android, YouTube Music, TV
// embed). They are server-side scoped to the matching client name
// + version pair and have no quota tied to any developer account
// we control — they are not credentials we can rotate.
//
// Public references shipping the same constants:
//   - yt-dlp:   https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_base.py
//   - NewPipe:  https://github.com/TeamNewPipe/NewPipeExtractor
//   - Invidious / Piped / rustypipe — all ship them in the clear.
//
// Removing them breaks the kernel entirely (every call to
// youtubei/v1/player would 400). This file is allowlisted in
// `.gitguardian.yaml`; if a new GitGuardian alert fires, mark it
// "false positive" in the dashboard.

#[derive(Debug, Clone, Copy)]
pub struct ClientProfile {
    pub name: &'static str,
    pub version: &'static str,
    pub api_key: &'static str,
    pub user_agent: &'static str,
    pub client_id: &'static str,
    pub os_name: &'static str,
    pub os_version: &'static str,
    pub extra_context: Option<&'static str>,
}

/// Order matters: clients more likely to return playable combined
/// streams (audio+video in one URL) first. IOS has the cleanest mp4
/// output today; ANDROID still works for many videos;
/// TVHTML5_SIMPLY_EMBEDDED_PLAYER is the last-resort fallback for
/// restricted content (its streams are typically adaptive-only, no
/// combined mp4).
///
/// `ANDROID_MUSIC` is special: it talks to the YouTube Music backend,
/// which returns audio-only m4a URLs the CDN serves without the
/// PoToken / n-parameter dance regular YouTube audio now requires.
pub const ALL_CLIENTS: &[ClientProfile] = &[
    ClientProfile {
        name: "IOS",
        version: "20.10.4",
        api_key: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
        user_agent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
        client_id: "5",
        os_name: "iOS",
        os_version: "18.3.2.22D82",
        extra_context: Some(r#"{"deviceMake":"Apple","deviceModel":"iPhone16,2"}"#),
    },
    ClientProfile {
        name: "ANDROID",
        version: "20.10.38",
        api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
        user_agent: "com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US) gzip",
        client_id: "3",
        os_name: "Android",
        os_version: "13",
        extra_context: Some(r#"{"androidSdkVersion":34}"#),
    },
    ClientProfile {
        name: "ANDROID_MUSIC",
        version: "7.27.52",
        api_key: "AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXEo8AI",
        user_agent: "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 14)",
        client_id: "21",
        os_name: "Android",
        os_version: "14",
        extra_context: Some(r#"{"androidSdkVersion":34}"#),
    },
    ClientProfile {
        name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
        version: "2.0",
        api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        user_agent: "Mozilla/5.0 (PlayStation 4 5.55) AppleWebKit/601.2 (KHTML, like Gecko)",
        client_id: "85",
        os_name: "Tizen",
        os_version: "5.0",
        extra_context: None,
    },
    // Desktop web client. Returns signatureCipher-protected formats
    // we need to unlock via player.js — see `youtube_kernel/sigcipher`.
    // Used as a final fallback when the mobile/TV clients refuse a
    // video; gives access to streams the others won't serve, at the
    // cost of running the JS decoders.
    ClientProfile {
        name: "WEB",
        version: "2.20240801.00.00",
        api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                     (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        client_id: "1",
        os_name: "Windows",
        os_version: "10.0",
        extra_context: None,
    },
];

/// Default client probe order — used for metadata and combined-MP4
/// resolution. IOS first because its mp4 streams are the cleanest.
pub fn default_clients() -> Vec<&'static ClientProfile> {
    ALL_CLIENTS.iter().collect()
}

/// Audio-first client order: ANDROID_MUSIC leads. The YouTube Music
/// backend hands out audio URLs the CDN serves without
/// PoToken/n-param checks, which is the cliff regular YouTube audio
/// falls off in 2025. ANDROID is the second-best fallback for
/// content not on YT Music.
pub fn audio_clients() -> Vec<&'static ClientProfile> {
    let preferred = ["ANDROID_MUSIC", "ANDROID", "IOS", "TVHTML5_SIMPLY_EMBEDDED_PLAYER"];
    let mut v: Vec<&'static ClientProfile> = Vec::new();
    for name in preferred {
        if let Some(c) = ALL_CLIENTS.iter().find(|c| c.name == name) {
            v.push(c);
        }
    }
    v
}

/// Single-element list with just the WEB client. Used by the
/// signature-unlock fallback path: WEB returns ciphered formats
/// (`signatureCipher`) that we run through the JS decoders. Other
/// clients return plain URLs, which is what `audio_clients()` /
/// `default_clients()` exploit.
pub fn web_client_only() -> Vec<&'static ClientProfile> {
    let mut v: Vec<&'static ClientProfile> = Vec::new();
    if let Some(c) = ALL_CLIENTS.iter().find(|c| c.name == "WEB") {
        v.push(c);
    }
    v
}

/// Lookup helper for tests / diagnostics.
pub fn find_client(name: &str) -> Option<&'static ClientProfile> {
    ALL_CLIENTS.iter().find(|c| c.name == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_clients_unique_names() {
        let names: Vec<&str> = ALL_CLIENTS.iter().map(|c| c.name).collect();
        let mut sorted = names.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(names.len(), sorted.len(), "duplicate client name");
    }

    #[test]
    fn audio_clients_does_not_include_web() {
        // The audio fast-path explicitly avoids WEB so we don't pay
        // for JS decoding when a mobile client can serve plain URLs.
        let names: Vec<&str> = audio_clients().iter().map(|c| c.name).collect();
        assert!(!names.contains(&"WEB"), "audio_clients should not include WEB");
    }

    #[test]
    fn web_client_only_has_just_web() {
        let v = web_client_only();
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].name, "WEB");
    }

    #[test]
    fn find_client_resolves_known_names() {
        assert!(find_client("WEB").is_some());
        assert!(find_client("ANDROID_MUSIC").is_some());
        assert!(find_client("DOES_NOT_EXIST").is_none());
    }
}
