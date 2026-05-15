#![allow(dead_code)]

// Tiny boa_engine wrapper for the sigcipher / n-param decoders.

use boa_engine::{js_string, Context, JsValue, Source};

pub struct CompiledJs {
    ctx: Context,
    fn_name: String,
}

impl CompiledJs {
    pub fn compile(source: &str, fn_name: &str) -> Result<Self, String> {
        let mut ctx = Context::default();
        ctx.eval(Source::from_bytes(source))
            .map_err(|e| format!("js compile: {e}"))?;
        Ok(Self {
            ctx,
            fn_name: fn_name.to_string(),
        })
    }

    pub fn apply(&mut self, arg: &str) -> Result<String, String> {
        let global = self.ctx.global_object();
        let func_val = global
            .get(js_string!(self.fn_name.clone()), &mut self.ctx)
            .map_err(|e| format!("js lookup '{}': {e}", self.fn_name))?;
        let func = func_val
            .as_callable()
            .ok_or_else(|| format!("'{}' is not callable", self.fn_name))?;
        let result = func
            .call(
                &JsValue::undefined(),
                &[JsValue::from(js_string!(arg))],
                &mut self.ctx,
            )
            .map_err(|e| format!("js call '{}': {e}", self.fn_name))?;
        result
            .to_string(&mut self.ctx)
            .map(|s| s.to_std_string_escaped())
            .map_err(|e| format!("js coerce result: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calls_a_simple_function() {
        let src = r#"
            function decode(s) {
                return s.split('').reverse().join('');
            }
        "#;
        let mut compiled = CompiledJs::compile(src, "decode").unwrap();
        assert_eq!(compiled.apply("hello").unwrap(), "olleh");
        assert_eq!(compiled.apply("world").unwrap(), "dlrow");
    }

    #[test]
    fn handles_unicode() {
        let src = r#"
            function passthrough(s) { return s; }
        "#;
        let mut compiled = CompiledJs::compile(src, "passthrough").unwrap();
        assert_eq!(compiled.apply("café 🎵").unwrap(), "café 🎵");
    }

    #[test]
    fn errors_when_function_missing() {
        let src = "var x = 1;";
        // CompiledJs doesn't impl Debug because boa's Context
        // doesn't, so we match manually rather than use unwrap_err.
        let mut compiled = match CompiledJs::compile(src, "nope") {
            Ok(c) => c,
            Err(e) => panic!("expected compile to succeed, got: {e}"),
        };
        match compiled.apply("anything") {
            Ok(v) => panic!("expected an error, got value {v}"),
            Err(e) => assert!(e.contains("not callable") || e.contains("nope"), "got: {e}"),
        }
    }

    #[test]
    fn errors_on_invalid_js() {
        match CompiledJs::compile("function (((", "decode") {
            Ok(_) => panic!("expected compile error"),
            Err(e) => assert!(e.contains("js compile"), "got: {e}"),
        }
    }
}
