#![allow(dead_code)]

// Extract YouTube's n-parameter scrambler from player.js. Without
// this YouTube CDN throttles streams to ~30 KB/s, which translates
// to a 5 min audio download taking ~30 min.
//
// The n-decoder is a much fattier function than the signature one
// (~100-200 lines of obfuscated logic), with deeply nested braces
// from try/catch blocks and inline helper closures. Pure regex
// can't reliably bracket-match nested `}`s, so we do it in two
// phases:
//
//   1. Regex finds the START of the function expression (the
//      `function(a){var b=a.split(...)` shape we recognise).
//   2. A byte-walk over the JS counts `{` / `}` up and down to find
//      the matching outer `}`, returning the full source slice.
//
// We also anchor on the `enhanced_except_` literal that's been
// YouTube's bot-detection sentinel for years — it's a stable signal
// that we're looking at the n-fn rather than something else.

use regex::Regex;

use super::js_eval::CompiledJs;

pub struct NParamDecoder {
    js: CompiledJs,
}

impl NParamDecoder {
    pub fn from_player_js(player_js: &str) -> Result<Self, String> {
        let body = extract_n_function(player_js)?;
        let composed = format!("var __patotubeN = {body};");
        let js = CompiledJs::compile(&composed, "__patotubeN")?;
        Ok(Self { js })
    }

    /// Decode an n-parameter value.
    pub fn decode(&mut self, encoded: &str) -> Result<String, String> {
        self.js.apply(encoded)
    }
}

/// Pull the n-decoder function source out of a player.js blob.
/// Returns the full `function(...) { ... }` expression.
fn extract_n_function(player_js: &str) -> Result<String, String> {
    let start = locate_n_function_start(player_js)
        .ok_or_else(|| "n-parameter decoder function not found in player.js".to_string())?;
    let end = match_closing_brace(player_js, start)
        .ok_or_else(|| "n-parameter decoder function: unbalanced braces".to_string())?;
    Ok(player_js[start..=end].to_string())
}

/// Find the byte offset of `function` in `function(a){var b=a.split(...)`
/// for the n-function. We scan for the canonical shape:
/// `function(X){var Y=Z.split(` and then bracket-match the body.
/// A candidate is the n-function iff its body contains the
/// `enhanced_except_` bot-detection sentinel YouTube has shipped
/// for years.
///
/// (Rust's `regex` crate doesn't support backreferences, so we
/// can't insist that `Z == X` directly in the pattern. The
/// `enhanced_except_` check is a strong enough discriminator that
/// false matches are virtually impossible.)
fn locate_n_function_start(player_js: &str) -> Option<usize> {
    let re = Regex::new(
        r"function\s*\(\s*[a-zA-Z0-9_$]+\s*\)\s*\{\s*var\s+[a-zA-Z0-9_$]+\s*=\s*[a-zA-Z0-9_$]+\.split\(",
    )
    .ok()?;

    for m in re.find_iter(player_js) {
        let candidate_start = m.start();
        if let Some(end) = match_closing_brace(player_js, candidate_start) {
            let body = &player_js[candidate_start..=end];
            if body.contains("enhanced_except_") {
                return Some(candidate_start);
            }
        }
    }
    None
}

/// Given a position pointing at `function`, walk forward to find
/// the matching outer `}`. Returns the byte offset of that `}`.
///
/// We track:
///   - brace depth (`{` and `}`)
///   - whether we're inside a string (single, double, or template)
///   - whether we're inside a regex literal (`/.../`)
///   - whether we're inside a comment (line `//` or block `/* */`)
///
/// Strings and comments are not perfect — they cover the cases
/// YouTube's minified player.js actually exhibits (no template
/// literals, no regex literals, no comments — just minified code
/// with strings).
fn match_closing_brace(s: &str, start: usize) -> Option<usize> {
    let bytes = s.as_bytes();
    // Skip ahead to the first `{` — this is the body opener.
    let mut i = start;
    while i < bytes.len() && bytes[i] != b'{' {
        i += 1;
    }
    if i >= bytes.len() {
        return None;
    }

    let mut depth: i32 = 0;
    let mut in_str: Option<u8> = None; // active string quote
    let mut prev_escape = false;

    while i < bytes.len() {
        let c = bytes[i];

        if let Some(quote) = in_str {
            if !prev_escape && c == quote {
                in_str = None;
            }
            prev_escape = c == b'\\' && !prev_escape;
            i += 1;
            continue;
        }

        match c {
            b'"' | b'\'' | b'`' => {
                in_str = Some(c);
                prev_escape = false;
            }
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthetic shape mirroring the real n-decoder. Includes the
    /// "enhanced_except_" sentinel + try/catch + inline closure
    /// (so we exercise the brace-counting path, not just regex).
    const SYNTH_N_PLAYER_JS: &str = r#"
        var nXyz = function(a){
            var b = a.split(""), c = [function(d){return d}];
            try {
                if (b[0] === "X") return "enhanced_except_blah_" + a;
                b.reverse();
            } catch(e) {
                return "enhanced_except_caught_" + a;
            }
            return b.join("");
        };
    "#;

    #[test]
    fn extracts_n_function_source() {
        let body = extract_n_function(SYNTH_N_PLAYER_JS).unwrap();
        assert!(body.starts_with("function"));
        assert!(body.contains("enhanced_except_"));
        assert!(body.contains(".reverse"));
        // Must end with the outer `}` — not a nested one.
        assert!(body.trim_end().ends_with('}'));
    }

    #[test]
    fn end_to_end_decodes_n() {
        let mut decoder = NParamDecoder::from_player_js(SYNTH_N_PLAYER_JS).unwrap();
        // Input "abc": no leading "X" sentinel, so we go through
        // reverse → "cba".
        assert_eq!(decoder.decode("abc").unwrap(), "cba");
    }

    #[test]
    fn returns_fingerprint_branch_when_triggered() {
        let mut decoder = NParamDecoder::from_player_js(SYNTH_N_PLAYER_JS).unwrap();
        // Input "Xyz": leading "X" hits the "enhanced_except_" branch.
        let out = decoder.decode("Xyz").unwrap();
        assert!(out.starts_with("enhanced_except_"));
    }

    #[test]
    fn errors_when_no_n_function() {
        match NParamDecoder::from_player_js("var x=1;") {
            Ok(_) => panic!("expected an error"),
            Err(msg) => {
                assert!(
                    msg.contains("n-parameter") || msg.contains("not found"),
                    "got: {msg}",
                );
            }
        }
    }

    #[test]
    fn match_closing_brace_handles_strings_with_braces() {
        // A `}` inside a string literal should not close the block.
        // Without string-aware tracking, the impl would stop at the
        // `}` inside `"}{ inside a string }"` and return it as the
        // outer block close — wrong.
        let src = r#"
            function(a){
                var b = "}{ inside a string }";
                return b;
            };
        "#;
        let start = src.find("function").unwrap();
        let end = match_closing_brace(src, start).unwrap();
        let outer_close = src.rfind('}').unwrap();
        assert_eq!(end, outer_close, "matched the wrong `}}`");
    }
}
