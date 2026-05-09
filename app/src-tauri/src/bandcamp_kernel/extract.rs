// Pull the per-track JSON blob out of a Bandcamp page HTML and
// pick the streamable URL out of it.
//
// Bandcamp embeds all track metadata in a `data-tralbum=...`
// attribute on the page (see yt-dlp's Bandcamp extractor for the
// canonical reference). The blob holds an array of trackinfo
// entries; each one has a `file` map keyed by format codes like
// `mp3-128`. We pick the first track of the page (single-track
// URLs only have one; album URLs have many — album support could
// follow later).

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

use regex::Regex;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TrAlbum {
    pub artist: Option<String>,
    pub current: Option<TrAlbumCurrent>,
    #[serde(default)]
    pub trackinfo: Vec<TrTrackInfo>,
    pub art_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct TrAlbumCurrent {
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrTrackInfo {
    pub title: Option<String>,
    /// Length in seconds. May come back as integer or float depending
    /// on the album page; both deserialise via `f64`.
    pub duration: Option<f64>,
    /// Map of `<codec>-<bitrate>` → URL. Bandcamp's free preview
    /// almost always exposes `mp3-128`; paid streams may add
    /// `mp3-V0`, `flac`, etc. (only with purchase / artist
    /// permission, so we can't rely on them).
    pub file: Option<std::collections::HashMap<String, String>>,
}

/// Extract the JSON payload from a `data-tralbum="…"` (or
/// `'…'`) attribute. Bandcamp HTML-encodes `&` and the inner
/// quote inside the attribute so we have to decode entities
/// before serde-parsing.
///
/// Rust's regex crate has no backreferences, so we try the two
/// quote shapes as separate patterns rather than `(["'])…\1`.
pub fn extract_tralbum(page_html: &str) -> Result<TrAlbum, String> {
    // `(?s)` lets `.` match newlines — Bandcamp pretty-prints
    // the JSON across multiple lines.
    let patterns = [
        r#"(?s)data-tralbum="(?P<json>\{.+?\})""#,
        r#"(?s)data-tralbum='(?P<json>\{.+?\})'"#,
    ];

    for pat in patterns {
        let re = Regex::new(pat).map_err(|e| format!("compile tralbum regex: {e}"))?;
        if let Some(caps) = re.captures(page_html) {
            if let Some(m) = caps.name("json") {
                let decoded = decode_html_entities(m.as_str());
                return serde_json::from_str(&decoded)
                    .map_err(|e| format!("could not parse tralbum JSON: {e}"));
            }
        }
    }
    Err("data-tralbum attribute not found in page HTML".to_string())
}

/// Pick the streamable URL for the first track in the album.
/// Returns `(url, extension)`; extension is "mp3" today (Bandcamp
/// only exposes `mp3-128` for free streams).
pub fn pick_first_stream(tralbum: &TrAlbum) -> Result<(String, &'static str), String> {
    let track = tralbum
        .trackinfo
        .first()
        .ok_or_else(|| "Bandcamp page exposes no tracks".to_string())?;
    let file_map = track
        .file
        .as_ref()
        .ok_or_else(|| "track has no `file` block — likely a paid-only release".to_string())?;
    // Free preview format. Bandcamp also serves `mp3-V0` and
    // `flac` to authenticated buyers but we don't ship login.
    let url = file_map
        .get("mp3-128")
        .or_else(|| file_map.values().next())
        .ok_or_else(|| "track exposes no streamable formats".to_string())?;
    Ok((normalise_proto_relative(url), "mp3"))
}

/// Pull the title for the first track. Falls back to the album's
/// `current.title` if the per-track title is missing.
pub fn pick_title(tralbum: &TrAlbum) -> String {
    tralbum
        .trackinfo
        .first()
        .and_then(|t| t.title.clone())
        .or_else(|| tralbum.current.as_ref().and_then(|c| c.title.clone()))
        .unwrap_or_else(|| "Bandcamp track".to_string())
}

/// Bandcamp serves stream URLs as `//t4.bcbits.com/...` (no
/// scheme). reqwest needs an absolute URL.
fn normalise_proto_relative(url: &str) -> String {
    if let Some(rest) = url.strip_prefix("//") {
        format!("https://{rest}")
    } else {
        url.to_string()
    }
}

/// Minimal HTML-entity decoder — we only need `&quot;`, `&amp;`,
/// `&#39;` because that's what Bandcamp uses inside data-tralbum.
/// A full crate would be overkill.
fn decode_html_entities(s: &str) -> String {
    s.replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal page mimicking the shape Bandcamp ships. `&quot;`
    /// inside the attribute is the realistic encoding to test
    /// against.
    const SYNTH_PAGE: &str = r#"
        <!doctype html>
        <html>
        <body>
        <div data-tralbum="{
          &quot;artist&quot;: &quot;Test Artist&quot;,
          &quot;current&quot;: { &quot;title&quot;: &quot;Album Title&quot; },
          &quot;trackinfo&quot;: [
            {
              &quot;title&quot;: &quot;Track One&quot;,
              &quot;duration&quot;: 245.7,
              &quot;file&quot;: {
                &quot;mp3-128&quot;: &quot;//t4.bcbits.com/stream/abc/mp3-128/12345?token=xxx&quot;
              }
            }
          ]
        }">
        </div>
        </body>
        </html>
    "#;

    #[test]
    fn extracts_tralbum_from_page() {
        let t = extract_tralbum(SYNTH_PAGE).unwrap();
        assert_eq!(t.artist.as_deref(), Some("Test Artist"));
        assert_eq!(t.trackinfo.len(), 1);
        assert_eq!(t.trackinfo[0].title.as_deref(), Some("Track One"));
        assert_eq!(t.trackinfo[0].duration, Some(245.7));
    }

    #[test]
    fn picks_first_stream_url() {
        let t = extract_tralbum(SYNTH_PAGE).unwrap();
        let (url, ext) = pick_first_stream(&t).unwrap();
        assert_eq!(url, "https://t4.bcbits.com/stream/abc/mp3-128/12345?token=xxx");
        assert_eq!(ext, "mp3");
    }

    #[test]
    fn errors_when_track_has_no_file_block() {
        let html = r#"<div data-tralbum="{
            &quot;trackinfo&quot;: [{ &quot;title&quot;: &quot;Paid Track&quot; }]
        }"></div>"#;
        let t = extract_tralbum(html).unwrap();
        match pick_first_stream(&t) {
            Ok(_) => panic!("expected error"),
            Err(e) => assert!(e.contains("paid-only"), "got: {e}"),
        }
    }

    #[test]
    fn errors_when_no_tralbum_in_page() {
        match extract_tralbum("<html></html>") {
            Ok(_) => panic!("expected error"),
            Err(e) => assert!(e.contains("data-tralbum"), "got: {e}"),
        }
    }

    #[test]
    fn pick_title_falls_back_to_album_title() {
        let html = r#"<div data-tralbum="{
            &quot;current&quot;: { &quot;title&quot;: &quot;Album Title&quot; },
            &quot;trackinfo&quot;: [{ &quot;file&quot;: { &quot;mp3-128&quot;: &quot;//x/y&quot; } }]
        }"></div>"#;
        let t = extract_tralbum(html).unwrap();
        assert_eq!(pick_title(&t), "Album Title");
    }

    #[test]
    fn normalises_proto_relative_url() {
        assert_eq!(
            normalise_proto_relative("//cdn.example.com/x"),
            "https://cdn.example.com/x"
        );
        assert_eq!(
            normalise_proto_relative("https://already.absolute/y"),
            "https://already.absolute/y"
        );
    }
}
