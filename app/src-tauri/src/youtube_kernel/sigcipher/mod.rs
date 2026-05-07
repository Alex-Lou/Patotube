#![allow(dead_code)]

// Patotube signature/n-parameter unlock pipeline.
//
// YouTube protects audio CDN URLs with two scrambling layers:
//
//   1. signatureCipher: an `s=...` value that has to be passed
//      through a JS-defined decoder before being attached to the URL
//      under a `sp=...`-named query parameter. Used on most adaptive
//      audio streams (DASH/Opus/m4a).
//
//   2. n parameter: a `n=...` query string already on the URL whose
//      value has to be passed through a different JS decoder; YouTube
//      throttles the CDN response to ~30 KB/s if the n value is left
//      un-scrambled.
//
// Both decoders live inside the player.js the watch page references.
// We fetch player.js, extract the two function bodies via regex,
// and run them through `boa_engine` (a pure-Rust JS interpreter).
//
// Public surface:
//
//   - `Unlocker::from_player_js(src)` — build both decoders.
//   - `unlocker.unlock_url(url, signature_cipher)` — produce a
//     downloadable URL from a Format's url/cipher fields.
//
// See `docs/youtube-kernel.md` ("Phase 2") for the broader plan.

mod js_eval;
mod nparam;
mod signature;

// Player.js fetching uses reqwest, which is in the Android-only dep
// table. The HTML-parsing helper (`extract_player_js_url`) is pure
// and would be useful to test on desktop, but we keep the file
// together rather than splitting it for one function.
#[cfg(target_os = "android")]
mod player_js;

use std::collections::HashMap;

#[cfg(target_os = "android")]
pub use player_js::{extract_player_js_url, fetch_player_js};

use self::nparam::NParamDecoder;
use self::signature::SignatureDecoder;

/// Combined signature + n-parameter decoder for one player.js.
/// Hold onto one of these per player.js URL (cached at the call site)
/// and run every URL through `unlock_url`.
pub struct Unlocker {
    sig: SignatureDecoder,
    n: NParamDecoder,
}

impl Unlocker {
    pub fn from_player_js(player_js: &str) -> Result<Self, String> {
        let sig = SignatureDecoder::from_player_js(player_js)
            .map_err(|e| format!("signature decoder: {e}"))?;
        let n = NParamDecoder::from_player_js(player_js)
            .map_err(|e| format!("n-parameter decoder: {e}"))?;
        Ok(Self { sig, n })
    }

    /// Take the values from a Format entry and produce a downloadable
    /// URL with the n-parameter unscrambled and (if applicable) the
    /// signature decoded and attached.
    ///
    /// `direct_url` is the format's `url` field, used directly when
    /// present. `signature_cipher` is the format's `signatureCipher`
    /// field, parsed for the encoded `s`/`url`/`sp` fields when the
    /// direct URL is absent.
    pub fn unlock_url(
        &mut self,
        direct_url: Option<&str>,
        signature_cipher: Option<&str>,
    ) -> Result<String, String> {
        let raw = if let Some(u) = direct_url {
            u.to_string()
        } else if let Some(sc) = signature_cipher {
            self.url_from_signature_cipher(sc)?
        } else {
            return Err("format has neither url nor signatureCipher".into());
        };

        self.unscramble_n_parameter(&raw)
    }

    /// Parse a `signatureCipher` blob (a query-string of `s=…&sp=…&url=…`),
    /// decode the `s` value, and attach it to the underlying url under
    /// the `sp`-named parameter (defaulting to "signature").
    fn url_from_signature_cipher(&mut self, cipher: &str) -> Result<String, String> {
        let parsed = parse_query_string(cipher);
        let s = parsed
            .get("s")
            .ok_or_else(|| "signatureCipher missing `s`".to_string())?;
        let underlying = parsed
            .get("url")
            .ok_or_else(|| "signatureCipher missing `url`".to_string())?;
        let sp = parsed
            .get("sp")
            .map(|v| v.as_str())
            .unwrap_or("signature");

        let decoded = self.sig.decode(s)?;
        Ok(append_query_param(underlying, sp, &decoded))
    }

    /// Find the `n=…` parameter in the URL, decode it through the JS
    /// decoder, and return the URL with the new `n` value swapped in.
    /// If the URL has no `n` parameter we return it unchanged — some
    /// older formats don't use one.
    fn unscramble_n_parameter(&mut self, url: &str) -> Result<String, String> {
        let Some((before_n, n_value, after_n)) = split_at_query_param(url, "n") else {
            return Ok(url.to_string());
        };
        let decoded = self.n.decode(&n_value)?;
        Ok(format!("{before_n}n={decoded}{after_n}"))
    }
}

// --- query-string helpers (no full URL parser dep) ----------------

/// Parse a `key=value&key=value` blob with URL-decoding. Stops at the
/// first invalid pair rather than erroring — YouTube sometimes adds
/// non-standard fields we don't care about.
fn parse_query_string(qs: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for pair in qs.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let key = url_decode(k);
            let val = url_decode(v);
            out.insert(key, val);
        }
    }
    out
}

/// Append `?key=value` (or `&key=value`) to a URL. The caller is
/// responsible for url-encoding the value if it contains reserved
/// characters; we leave it unencoded so signatures pass through
/// unchanged (YouTube's signature output is already safe).
fn append_query_param(url: &str, key: &str, value: &str) -> String {
    let sep = if url.contains('?') { '&' } else { '?' };
    format!("{url}{sep}{key}={value}")
}

/// Locate `key=value` inside a URL's query string. Returns
/// `(prefix_up_to_and_including_key=, value, suffix_starting_with_&_or_empty)`.
/// Used by `unscramble_n_parameter` so we can swap the value
/// in-place without re-serialising the full query.
fn split_at_query_param(url: &str, key: &str) -> Option<(String, String, String)> {
    let needle = format!("{key}=");
    // Look for `?key=` or `&key=` to avoid matching inside a path.
    let candidates = [format!("?{needle}"), format!("&{needle}")];
    let mut idx = None;
    for sentinel in &candidates {
        if let Some(i) = url.find(sentinel.as_str()) {
            idx = Some(i + 1); // skip the `?` or `&`
            break;
        }
    }
    let start = idx?;
    let value_start = start + needle.len();
    let after_value = url[value_start..].find('&').map(|i| value_start + i);
    let (value, suffix) = match after_value {
        Some(end) => (url[value_start..end].to_string(), url[end..].to_string()),
        None => (url[value_start..].to_string(), String::new()),
    };
    let before = url[..start].to_string();
    Some((before, value, suffix))
}

/// Tiny percent-decode. We only need to handle `%XX` and `+`-as-space
/// because YouTube's signatureCipher payloads are simple. Falls back
/// to leaving an undecodable sequence in place.
fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = hex_nibble(bytes[i + 1]);
                let lo = hex_nibble(bytes[i + 2]);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push((h << 4) | l);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_nibble(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(10 + b - b'a'),
        b'A'..=b'F' => Some(10 + b - b'A'),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_query_string() {
        let qs = "s=ABC&sp=sig&url=https%3A%2F%2Fexample.com%2Fa";
        let parsed = parse_query_string(qs);
        assert_eq!(parsed.get("s").map(String::as_str), Some("ABC"));
        assert_eq!(parsed.get("sp").map(String::as_str), Some("sig"));
        assert_eq!(
            parsed.get("url").map(String::as_str),
            Some("https://example.com/a"),
        );
    }

    #[test]
    fn url_decode_handles_plus_and_percent() {
        assert_eq!(url_decode("hello+world"), "hello world");
        assert_eq!(url_decode("%2F%2Fa%2Fb"), "//a/b");
        assert_eq!(url_decode("foo%2"), "foo%2"); // partial → leave alone
    }

    #[test]
    fn append_query_param_appends_with_correct_separator() {
        assert_eq!(
            append_query_param("https://x.com/a", "sig", "VAL"),
            "https://x.com/a?sig=VAL",
        );
        assert_eq!(
            append_query_param("https://x.com/a?b=c", "sig", "VAL"),
            "https://x.com/a?b=c&sig=VAL",
        );
    }

    #[test]
    fn split_at_query_param_finds_value_in_query_only() {
        // Path containing 'n=' shouldn't be matched; only the query
        // string should be considered.
        let url = "https://x.com/n=path?a=1&n=NVAL&z=9";
        let (before, value, after) = split_at_query_param(url, "n").unwrap();
        assert_eq!(before, "https://x.com/n=path?a=1&");
        assert_eq!(value, "NVAL");
        assert_eq!(after, "&z=9");
    }

    #[test]
    fn split_at_query_param_handles_param_at_end() {
        let url = "https://x.com/a?n=VAL";
        let (before, value, after) = split_at_query_param(url, "n").unwrap();
        assert_eq!(before, "https://x.com/a?");
        assert_eq!(value, "VAL");
        assert_eq!(after, "");
    }

    #[test]
    fn split_at_query_param_returns_none_when_missing() {
        assert!(split_at_query_param("https://x.com/a?b=1", "n").is_none());
    }

    /// End-to-end test: synthetic player.js with both decoders +
    /// a fake signatureCipher / URL with an `n` parameter.
    /// Verifies the whole unlock pipeline runs together.
    const SYNTH_PLAYER_JS: &str = r#"
        var Hh={
            r:function(a){a.reverse()},
            s:function(a,b){var c=a[0];a[0]=a[b%a.length];a[b%a.length]=c}
        };
        Sg=function(a){a=a.split("");Hh.r(a);return a.join("")};
        var nXyz = function(a){
            var b = a.split("");
            try { if (b[0] === "X") return "enhanced_except_" + a; b.reverse(); }
            catch(e) { return "enhanced_except_" + a; }
            return b.join("");
        };
    "#;

    #[test]
    fn unlocks_signature_cipher_url() {
        let mut unlocker = Unlocker::from_player_js(SYNTH_PLAYER_JS).unwrap();
        // signatureCipher pretends "abc" is the encoded sig; URL has
        // no n param so the n-decoder is a no-op.
        let cipher = "s=abc&sp=signature&url=https%3A%2F%2Fcdn.example%2Faudio";
        let unlocked = unlocker.unlock_url(None, Some(cipher)).unwrap();
        // Sig "abc" → reversed "cba" → attached as ?signature=cba
        assert_eq!(unlocked, "https://cdn.example/audio?signature=cba");
    }

    #[test]
    fn unscrambles_n_parameter_on_direct_url() {
        let mut unlocker = Unlocker::from_player_js(SYNTH_PLAYER_JS).unwrap();
        let url = "https://cdn.example/audio?a=1&n=abc&z=9";
        let unlocked = unlocker.unlock_url(Some(url), None).unwrap();
        // n="abc" → reverse → "cba"
        assert_eq!(unlocked, "https://cdn.example/audio?a=1&n=cba&z=9");
    }

    #[test]
    fn unlock_passes_through_when_no_n_parameter() {
        let mut unlocker = Unlocker::from_player_js(SYNTH_PLAYER_JS).unwrap();
        let url = "https://cdn.example/audio?a=1";
        let unlocked = unlocker.unlock_url(Some(url), None).unwrap();
        assert_eq!(unlocked, url);
    }

    #[test]
    fn errors_when_format_has_neither_url_nor_cipher() {
        let mut unlocker = Unlocker::from_player_js(SYNTH_PLAYER_JS).unwrap();
        match unlocker.unlock_url(None, None) {
            Ok(v) => panic!("expected error, got: {v}"),
            Err(e) => assert!(e.contains("neither"), "got: {e}"),
        }
    }
}
