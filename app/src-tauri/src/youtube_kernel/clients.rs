// Compiled everywhere so pure-Rust submodules (sigcipher etc.) build on desktop hosts.
#![allow(dead_code)]

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

pub const ALL_CLIENTS: &[ClientProfile] = &[
    // ANDROID_VR: most permissive client in 2026 — plain CDN URLs,
    // no PoToken / signature / API key. Version pinned at 1.65.10:
    // anything newer triggers SABR-only responses (yt-dlp ff459e5fc
    // commit, March 2026).
    // Caveat: "Made for kids" returns UNPLAYABLE (yt-dlp #15780),
    // hence the fallbacks below.
    ClientProfile {
        name: "ANDROID_VR",
        version: "1.65.10",
        api_key: "", // empty → call_player_api skips the ?key= param
        user_agent: "com.google.android.apps.youtube.vr.oculus/1.65.10 \
                     (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
        client_id: "28",
        os_name: "Android",
        os_version: "12L",
        extra_context: Some(r#"{"deviceMake":"Oculus","deviceModel":"Quest 3","androidSdkVersion":32}"#),
    },
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
    // WEB: returns signatureCipher-protected formats that require
    // player.js unlock (see `youtube_kernel/sigcipher`).
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

pub fn default_clients() -> Vec<&'static ClientProfile> {
    let preferred = [
        "ANDROID_VR",
        "IOS",
        "ANDROID",
        "ANDROID_MUSIC",
        "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    ];
    pick_in_order(&preferred)
}

pub fn audio_clients() -> Vec<&'static ClientProfile> {
    let preferred = [
        "ANDROID_VR",
        "ANDROID_MUSIC",
        "IOS",
        "ANDROID",
        "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    ];
    pick_in_order(&preferred)
}

fn pick_in_order(names: &[&str]) -> Vec<&'static ClientProfile> {
    let mut v: Vec<&'static ClientProfile> = Vec::new();
    for name in names {
        if let Some(c) = ALL_CLIENTS.iter().find(|c| c.name == *name) {
            v.push(c);
        }
    }
    v
}

pub fn web_client_only() -> Vec<&'static ClientProfile> {
    let mut v: Vec<&'static ClientProfile> = Vec::new();
    if let Some(c) = ALL_CLIENTS.iter().find(|c| c.name == "WEB") {
        v.push(c);
    }
    v
}

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
        let names: Vec<&str> = audio_clients().iter().map(|c| c.name).collect();
        assert!(!names.contains(&"WEB"), "audio_clients should not include WEB");
    }

    #[test]
    fn audio_clients_lead_with_android_vr() {
        let v = audio_clients();
        assert!(!v.is_empty());
        assert_eq!(v[0].name, "ANDROID_VR");
    }

    #[test]
    fn default_clients_lead_with_android_vr() {
        let v = default_clients();
        assert!(!v.is_empty());
        assert_eq!(v[0].name, "ANDROID_VR");
    }

    #[test]
    fn android_vr_carries_no_api_key() {
        // ANDROID_VR uses the un-keyed Innertube endpoint;
        // call_player_api keys off `api_key.is_empty()`.
        let vr = find_client("ANDROID_VR").expect("ANDROID_VR present");
        assert!(vr.api_key.is_empty(), "ANDROID_VR must carry an empty key");
        assert_eq!(vr.version, "1.65.10");
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
        assert!(find_client("ANDROID_VR").is_some());
        assert!(find_client("ANDROID_MUSIC").is_some());
        assert!(find_client("DOES_NOT_EXIST").is_none());
    }
}
