#![allow(dead_code)]

// Tiny wrapper around boa_engine. We use it to evaluate the small
// signature / n-parameter decoder functions we lift out of YouTube's
// player.js. Boa is a pure-Rust JS interpreter — slower than V8 or
// QuickJS but the two functions we run are <5 KB each and execute
// once per video, so the difference is unmeasurable.
//
// The "compiled function" here is just a `Context` with the function
// definition already evaluated, plus the function name to call.
// `apply` looks the function up on the global object and calls it
// with one string argument, returning the result as a Rust `String`.

use boa_engine::{js_string, Context, JsValue, Source};

pub struct CompiledJs {
    ctx: Context,
    fn_name: String,
}

impl CompiledJs {
    /// Compile a JS source blob containing a function definition.
    /// `source` should declare the function with the given `fn_name`
    /// at the top level so it lands on the global object.
    pub fn compile(source: &str, fn_name: &str) -> Result<Self, String> {
        let mut ctx = Context::default();
        ctx.eval(Source::from_bytes(source))
            .map_err(|e| format!("js compile: {e}"))?;
        Ok(Self {
            ctx,
            fn_name: fn_name.to_string(),
        })
    }

    /// Call the compiled function with a single string argument and
    /// return its result coerced to a Rust string. Used to apply
    /// signature / n-parameter decoders.
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
        // Reusable: the context is kept alive between calls.
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
