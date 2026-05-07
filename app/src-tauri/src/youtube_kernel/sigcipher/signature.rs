#![allow(dead_code)]

// Extract YouTube's signature decoder function from a player.js
// blob. Regex patterns mirror yt-dlp's `_youtube/_video.py` —
// they've held stable across multiple YouTube changes because the
// function shape (split → mutations → join) is structural and hasn't
// shifted in years.
//
// The signature cipher protects "older" stream URLs: the response's
// `signatureCipher` field carries an encoded signature `s`, an
// encoded URL, and the query-string parameter name `sp` to attach
// the decoded signature under. We extract the decoder from
// player.js, run the encoded `s` through it, then attach the
// result.
//
// See docs/youtube-kernel.md ("Phase 2") for context.

use regex::Regex;

use super::js_eval::CompiledJs;

/// A signature decoder built from a single player.js source. Hold on
/// to one of these per player.js (cached by hash) and call
/// `decode_signature(s)` for every cipher you encounter.
pub struct SignatureDecoder {
    js: CompiledJs,
    fn_name: String,
}

impl SignatureDecoder {
    /// Try to build a signature decoder from a player.js blob.
    /// Returns `Err` if either the entry function or its helper
    /// object is missing — likely because YouTube tweaked player.js
    /// in a way that breaks our regex (rare but does happen 1-2x
    /// per year).
    pub fn from_player_js(player_js: &str) -> Result<Self, String> {
        let entry = extract_entry_function(player_js)?;
        let helper_obj_name = extract_helper_obj_name(&entry.body)
            .ok_or_else(|| "could not locate helper object name".to_string())?;
        let helper_obj_src = extract_helper_object(player_js, &helper_obj_name)?;

        // Compose a tiny self-contained JS program: the helper
        // object definition + the entry function. We always rename
        // the entry to a known symbol (`__patotubeSig`) so the
        // js_eval wrapper doesn't need to track YouTube's
        // ever-changing variable names.
        let composed = format!(
            "{helper_obj_src}\nvar __patotubeSig = {body};",
            helper_obj_src = helper_obj_src,
            body = entry.expression
        );
        let js = CompiledJs::compile(&composed, "__patotubeSig")?;
        Ok(Self {
            js,
            fn_name: "__patotubeSig".into(),
        })
    }

    /// Decode an encoded signature value.
    pub fn decode(&mut self, encoded: &str) -> Result<String, String> {
        self.js.apply(encoded)
    }

    /// Function name we registered into the JS context. Useful for
    /// diagnostics; callers shouldn't need it for normal operation.
    pub fn function_name(&self) -> &str {
        &self.fn_name
    }
}

/// Bag of regex-extracted bits that describe the entry function.
struct EntryFunction {
    /// The `function(a){...}` expression, suitable for use as the
    /// right-hand side of `var X = …;`.
    expression: String,
    /// The function body alone — what's between the `{ }`. Used to
    /// hunt for the helper-object name reference.
    body: String,
}

/// Match: `Tn=function(a){a=a.split("");Yn.helper1(a,33);...return a.join("")};`
/// (or a `var Tn = function(...){...};` form). Captures the whole
/// function expression.
fn extract_entry_function(player_js: &str) -> Result<EntryFunction, String> {
    // yt-dlp's pattern. Anchored on the split→join shape, which is
    // the load-bearing structural invariant of the decoder.
    let re = Regex::new(
        r#"(?xs)
        (?:
            \b(?:var\s+)?[a-zA-Z0-9_$]+\s*=\s*
            (?P<expr>function\s*\(\s*[a-zA-Z0-9_$]+\s*\)\s*\{
                (?P<body>
                    \s*[a-zA-Z0-9_$]+\s*=\s*[a-zA-Z0-9_$]+\.split\(\s*(?:""|'')\s*\)\s*;
                    .+?
                    return\s+[a-zA-Z0-9_$]+\.join\(\s*(?:""|'')\s*\)
                )
                \s*\}\s*
            )
            ;
        )
        "#,
    )
    .map_err(|e| format!("compile entry-fn regex: {e}"))?;

    let caps = re
        .captures(player_js)
        .ok_or_else(|| "signature entry function not found in player.js".to_string())?;
    let expr = caps
        .name("expr")
        .ok_or_else(|| "entry-fn regex matched without `expr` group".to_string())?
        .as_str()
        .to_string();
    let body = caps
        .name("body")
        .ok_or_else(|| "entry-fn regex matched without `body` group".to_string())?
        .as_str()
        .to_string();
    Ok(EntryFunction {
        expression: expr,
        body,
    })
}

/// The entry function's body always references a helper object
/// holding the actual mutation primitives (reverse, slice, swap):
/// `Yn.helper1(a, 33)`. This grabs the helper's variable name.
///
/// We require ≥2 chars for the captured name to skip over the
/// `.split(`/`.join(` calls on the array variable itself, which
/// minified code spells with a single-char identifier (`a.split`).
/// YouTube has consistently named helper objects with 2-3 chars
/// (`Hh`, `Yn`, `Tn`, ...) for years.
fn extract_helper_obj_name(body: &str) -> Option<String> {
    let re = Regex::new(r"([a-zA-Z0-9_$]{2,})\.[a-zA-Z0-9_$]+\(").ok()?;
    re.captures(body).and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

/// Match: `var Yn={r:function(a){...},s:function(a,b){...}};`
///
/// We use a non-greedy body (`.*?`) so it stops at the FIRST `};`
/// closer rather than gobbling up subsequent statements. YouTube's
/// helper objects don't contain nested braces in their function
/// bodies (just simple array mutations like `.reverse()`,
/// `.splice()`, swap), so a flat `.*?` is sufficient and far less
/// fragile than a structural pattern.
fn extract_helper_object(player_js: &str, name: &str) -> Result<String, String> {
    let escaped = regex::escape(name);
    let pattern = format!(
        r"(?s)(?P<obj>(?:var\s+)?{name}\s*=\s*\{{.*?\}}\s*;)",
        name = escaped,
    );
    let re = Regex::new(&pattern)
        .map_err(|e| format!("compile helper-obj regex: {e}"))?;
    let caps = re
        .captures(player_js)
        .ok_or_else(|| format!("helper object '{name}' not found in player.js"))?;
    Ok(caps
        .name("obj")
        .ok_or_else(|| "helper-obj regex matched without `obj` group".to_string())?
        .as_str()
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal synthetic player.js with the same shape as the real
    /// one — entry function that splits, calls a helper object's
    /// methods, then joins. Lets us test extraction + execution
    /// without shipping a 2 MB fixture.
    const SYNTH_PLAYER_JS: &str = r#"
        // ... lots of YouTube code we don't care about ...
        var Hh={
            r:function(a){a.reverse()},
            s:function(a,b){var c=a[0];a[0]=a[b%a.length];a[b%a.length]=c},
            p:function(a,b){a.splice(0,b)}
        };
        Sg=function(a){a=a.split("");Hh.r(a);Hh.s(a,2);Hh.p(a,1);return a.join("")};
        // ... more code ...
    "#;

    #[test]
    fn extracts_entry_function() {
        let entry = extract_entry_function(SYNTH_PLAYER_JS).unwrap();
        assert!(entry.expression.starts_with("function"));
        assert!(entry.body.contains(".split"));
        assert!(entry.body.contains(".join"));
    }

    #[test]
    fn extracts_helper_obj_name_from_body() {
        let entry = extract_entry_function(SYNTH_PLAYER_JS).unwrap();
        let name = extract_helper_obj_name(&entry.body).unwrap();
        assert_eq!(name, "Hh");
    }

    #[test]
    fn extracts_helper_object_source() {
        let src = extract_helper_object(SYNTH_PLAYER_JS, "Hh").unwrap();
        assert!(src.contains("r:function"));
        assert!(src.contains("s:function"));
        assert!(src.contains("p:function"));
    }

    #[test]
    fn end_to_end_decodes_signature() {
        // Input "abcdef":
        //   split → [a,b,c,d,e,f]
        //   r (reverse) → [f,e,d,c,b,a]
        //   s(2) (swap [0] with [2 % 6 = 2]) → [d,e,f,c,b,a]
        //   p(1) (splice 0..1) → [e,f,c,b,a]
        //   join → "efcba"
        let mut decoder = SignatureDecoder::from_player_js(SYNTH_PLAYER_JS).unwrap();
        let out = decoder.decode("abcdef").unwrap();
        assert_eq!(out, "efcba");
    }

    #[test]
    fn errors_when_no_entry_function() {
        // Manual matching because SignatureDecoder doesn't impl Debug
        // (boa's Context isn't Debug), so `.unwrap_err()` won't work.
        match SignatureDecoder::from_player_js("var x=1;") {
            Ok(_) => panic!("expected an error"),
            Err(msg) => assert!(msg.contains("entry function"), "got: {msg}"),
        }
    }
}
