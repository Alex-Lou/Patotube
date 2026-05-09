# Patotube YouTube Kernel — Mobile Architecture

This document is the technical reference for Patotube's YouTube
extraction + post-processing pipeline on Android. Desktop uses
`yt-dlp` + `ffmpeg` as shell sidecars; mobile cannot, because neither
runs as a standalone arm64 binary inside an Android sandbox without
heroics. This doc explains how we approximate that pipeline natively.

Last updated: 2026-05-07. Owner: feat/tauri-shell branch.

## Goal

Reach feature parity with the desktop `yt-dlp -f "ba/b" -x
--audio-format m4a` pipeline on Android, without shipping Python or
ffmpeg binaries.

Concretely, downloading audio from YouTube on mobile must:

1. Resolve a playable stream URL (signature-decoded, n-parameter-decoded)
2. Stream it to disk
3. Produce a real audio-only `.m4a` — never a `.m4a` that's actually a
   `.mp4` with a video track inside, never a corrupted file no player
   can identify

Real per-bitrate MP3 transcoding (LAME) is out of scope on mobile
because YouTube serves a single fixed-bitrate AAC stream per video
and a true MP3 encoder isn't part of the Android SDK. Desktop keeps
that capability via the yt-dlp + ffmpeg sidecar pair.

## Design pivots — what we tried, why it didn't work

### Attempt 1: pure-Rust MP4 demuxer (alfg/mp4 crate)

Idea: after downloading the combined MP4 fallback, rewrite the
container in Rust to drop the video `trak`, keeping only the AAC
audio samples — no transcoding, no ffmpeg.

What broke: the alfg/mp4 crate produces structurally valid MP4 files
that nonetheless fail to play in Android's MediaPlayer and VLC. The
TrackConfig rebuild path loses subtle bytes from the AAC `esds` box
(SBR/PS extensions, bitrate VBR markers) and the `udta` /
edit-list boxes. Players see a file of the right shape but can't
decode it. No clean way to fix without reimplementing the writer.

Status: code reverted in this commit. The `mp4` crate dependency is
gone.

### Attempt 2: ffmpeg-kit AAR

Idea: pull `com.arthenica:ffmpeg-kit-audio:6.0-2` as a gradle
dependency, expose `transcodeToMp3` / `remuxToM4a` from a Kotlin
bridge, orchestrate from the frontend on `done` events.

What broke: the Arthenica project was sunsetted in early 2025 and
the binaries were yanked from Maven Central and JitPack. There are
community forks but none with the maintenance velocity to bet on for
a long-lived app. Adding a dead dependency that breaks new clones in
6 months is worse than no dependency.

Status: not adopted. No third-party AAR.

### Adopted: MediaExtractor + MediaMuxer (Android SDK)

The Android framework ships `android.media.MediaExtractor` and
`android.media.MediaMuxer` — exactly the demux / mux primitives we
need for audio-only remux. They've been part of the SDK since API 18
and are the same APIs Google's own audio apps use.

Approach:
1. Open the source MP4 with `MediaExtractor.setDataSource(srcPath)`
2. Find the first track whose mime starts with `audio/` (AAC for
   YouTube combined MP4)
3. Create a `MediaMuxer(dstPath, OUTPUT_FORMAT_MPEG_4)` (or `_OGG`
   if the source is Opus/WebM)
4. Add the audio track to the muxer with the source's `MediaFormat`
5. Stream samples via `extractor.readSampleData` →
   `muxer.writeSampleData` until exhausted
6. Stop + release both

The output is bit-perfect: the AAC bytes from the source are written
into the new container unchanged. Equivalent to
`ffmpeg -i src -vn -acodec copy dst.m4a` but with no external code.

Trade-off vs ffmpeg-kit: we lose MP3 encoding at user-chosen bitrate.
This is fine — see "On the bitrate picker" below.

## Current state vs target state

```
                     EXTRACTION                    POST-PROCESS
                     ──────────                    ────────────
desktop today:    yt-dlp (Python sidecar)    →  ffmpeg (sidecar)        ✓
android today:    youtubei/v1/player REST    →  MediaExtractor+Muxer    ✓ (Phase 1, this doc)
android target:   youtubei/v1/player REST    →  MediaExtractor+Muxer    ✓
                  + JS engine for sig/nparam       (Phase 2 — adds
                  (Phase 2)                         signature decoding
                                                    so audio-only
                                                    streams stop 403'ing)
```

## Phase 1 — MediaExtractor remux bridge

### Architecture

```
              Tauri Rust                Frontend (TS/React)            Kotlin (Android)
              ──────────                ──────────────────             ────────────────
                                          window.PatoMobile
              start_download()  ─────►   useDownloadActions
                                                │
              youtube_native.rs                  │
              ────────────────                   │
              try_audio_only ──fails──┐          │
              try_combined  ──ok─────►│          │
                                      ▼          ▼
              file at /sdcard/Download/Title.m4a   (combined MP4 with video)
              emit "done" with filePath  ───►  useDownloadEvents
                                                │
                                                │ if Android+audio:
                                                │   set status=converting
                                                │   await remuxAudioOnlyAsync(src, dst)
                                                │                    │
                                                │                    ▼
                                                │             PatoMobileBridge.kt
                                                │             ─────────────────────
                                                │             Thread {
                                                │               MediaExtractor +
                                                │               MediaMuxer pipeline
                                                │               (see remuxAudioOnly)
                                                │               webView.evaluateJavascript(
                                                │                 "__patotubeFFmpegCallback(...)"
                                                │               )
                                                │             }
                                                │                    │
                                                │   ◄────────────────┘
                                                │   resolves with "" or error message
                                                │
                                                │ on success: delete src, update queue,
                                                │             scanFile dst, status=done
```

### File flow

```
User picks "Audio" on a 10-min video:

1. Rust downloads /sdcard/Download/Title.m4a (~50 MB, contains video too)
2. Rust emits status=done, filePath=/sdcard/Download/Title.m4a
3. Frontend sees Android+audio, kicks remux:
     MediaExtractor reads Title.m4a, finds the audio track
     MediaMuxer writes Title.audio.m4a containing only that track
4. Kotlin worker thread does this in <1s for typical durations
5. Frontend deletes Title.m4a (the temp), promotes Title.audio.m4a → Title.m4a
6. MediaScanner pinged — file shows up in music apps immediately
7. Toast "Downloaded: Title" with the .m4a path
```

Total time on a Pixel 6 (representative test): ~30 s download + ~0.5
s remux for a 10-min audio.

### Components

| component | path | role |
|---|---|---|
| Kotlin bridge | `gen/android/app/.../PatoMobileBridge.kt` | exposes `remuxAudioOnly` / `deleteFile` to JS |
| JS bridge | `app/src/lib/android/bridge.ts` | promise wrappers + global callback registry |
| Orchestrator | `app/src/features/download/use-downloads.ts` | converts `done` → remux → `done` on Android+audio |
| Rust extractor | `app/src-tauri/src/youtube_native.rs` | unchanged for Phase 1; still does combined-fallback |

No new gradle dependencies, no new Cargo crates. The whole
post-processing path uses APIs already shipped in every Android
device since API 18.

### Why orchestrate from the frontend, not from Rust

We considered three integration patterns. The frontend-orchestrated
approach won because:

1. **No new Tauri commands needed.** Rust treats post-processing as
   "frontend's problem" — its job ends when bytes hit disk.
2. **No JNI from Rust.** Tauri 2's Rust→Android JNI surface is
   underdocumented and would need a custom plugin. We already have a
   working WebView `JavascriptInterface` bridge.
3. **Status visibility.** The frontend already owns `converting`
   status display in `queue-item.tsx`. Reusing it means no new UI
   plumbing.

The downside — synchronous file I/O happens on the WebView thread —
is sidestepped by spawning a `Thread {}` inside the Kotlin bridge and
calling back via `webView.evaluateJavascript`. UI never blocks.

### Async callback contract

The Kotlin bridge cannot return a value asynchronously through
`@JavascriptInterface`. Instead:

```
JS  ──► PatoMobileBridge.remuxAudioOnly(src, dst, callbackId)
        │
        ▼
        Thread { MediaExtractor + MediaMuxer pipeline; webView.evaluateJavascript(
          "window.__patotubeFFmpegCallback(callbackId, payload)"
        )}
        │
        ▼
        Frontend's __patotubeFFmpegCallback resolves the matching Promise
```

`callbackId` is a monotonic integer issued by the JS bridge. Pending
callbacks live in a `Map<number, (err: string) => void>` until
resolved or the page unloads. (The callback name keeps `FFmpeg` for
historical reasons even though we no longer use ffmpeg — renaming
isn't worth a coordinated bridge update.)

### Failure modes

| failure | handling |
|---|---|
| source has no audio track | bridge returns error "no audio track in source" → frontend marks job `failed` |
| MediaMuxer can't carry the audio mime | error like "container/codec mismatch" surfaced |
| `dst` not writable | IOException surfaced through the bridge |
| WebView destroyed mid-remux | callback never fires → frontend's 5-min timeout resolves the Promise with "timed out" |

### On the bitrate picker

YouTube hands one fixed-bitrate AAC stream per video on mobile. The
"128/192/256/320 kbps" picker that exists on desktop is meaningful
because yt-dlp pipes the source through ffmpeg+LAME to actually
encode at the chosen bitrate. On Android we have no LAME equivalent
(see "Attempt 2" above), so showing that picker on Android would be
a lie.

The mobile UI hides the picker and the format-kind label reads "M4A
audio" — honest about what the user gets: bit-perfect AAC at the
bitrate YouTube serves.

## Phase 2 — pure-Rust extraction kernel

Phase 2 replaces today's "try N clients, hope one returns plain CDN
URLs" strategy with a real signature/n-parameter unlock pipeline.
Module layout shipped:

```
youtube_kernel/sigcipher/
├── mod.rs            # public API: Unlocker.unlock_url(url, signatureCipher)
├── js_eval.rs        # boa wrapper: compile a JS function, call it with a string
├── signature.rs      # extract signatureCipher decoder fn from player.js
├── nparam.rs         # extract n-parameter decoder fn from player.js
└── player_js.rs      # fetch + 4-entry LRU cache of player.js source (Android-only)
```

Status as of 2026-05-07:

- ✅ boa_engine integrated (pure Rust JS interpreter; pure-Rust means
   no NDK clang at build time — the reason `rquickjs-sys` was
   rejected, since it needs bindgen + libclang from the NDK which
   fails on Windows hosts).
- ✅ Signature decoder: regex extracts `Sg=function(a){...}`-style
   entries plus the helper object they reference (e.g.
   `var Hh={r:function(a){...},...}`); the two are concatenated and
   compiled into a closure addressable as `__patotubeSig(...)`.
- ✅ N-parameter decoder: regex finds the function start, then a
   string-aware brace counter walks forward to find the matching
   outer `}` (we can't pure-regex this — bodies have nested braces
   from try/catch + inline closures + strings containing `}`).
- ✅ Unlocker assembles both decoders, parses the `signatureCipher`
   query-string, decodes the `s` value, and substitutes the
   `n=...` query parameter on the final URL.
- ✅ 24 unit tests against synthetic player.js fixtures with the
   same shape as YouTube's real one (entry function with split→join,
   helper object with reverse/swap/splice, n-fn with try/catch +
   `enhanced_except_` sentinel).
- ⚠️ NOT YET wired into `pick_audio` / `pick_video`. The kernel
   continues to use the multi-client REST-only path that works for
   most videos (and falls back to combined+remux on the rest).
   Wiring requires:
   1. Adding a `signatureCipher: Option<String>` field on
      `youtube_kernel::types::Format`.
   2. Calling `extract_player_js_url` against a watch-page HTML
      blob to find the per-video player.js URL.
   3. Caching the resulting `Unlocker` keyed on player.js URL.
   4. Running every format's url/cipher through it before download.
   5. Switching `audio_clients()` to lead with `WEB` (which serves
      ciphered URLs we can now unlock) instead of `ANDROID_MUSIC`.

### Why `boa` (pure Rust JS engine) and not `rquickjs`

| engine | speed | NDK clang? | binary size | maintenance |
|---|---|---|---|---|
| `rquickjs` | fast (C QuickJS) | required | small | external (bellard) |
| `boa_engine` | ~5× slower | not required | medium | active Rust project |
| `v8` | fastest | required | huge | Google |

The signature scripts are tiny (under 5 KB of JS) and run once per
video, so even `boa`'s slower interpretation is unnoticeable
(<50 ms). The crucial property is "no NDK clang at build time":
`rquickjs-sys` requires bindgen + libclang from the Android NDK,
which fails on Windows hosts unless the user does manual setup. `boa`
just builds.

### Brace counting vs. regex for n-parameter

The signature decoder body is small and flat — one line of helper
calls between split and join — so a single regex captures it. The
n-parameter decoder's body is larger and contains nested braces
(`try { ... } catch(e) { ... }`, anonymous helpers, strings with
literal `}`s), so regex alone can't reliably bracket-match the
outer `}`. `nparam.rs` solves this with a two-phase approach:

1. Regex finds the start (`function(X){var Y=Z.split(`).
2. `match_closing_brace` walks the bytes from the opening `{`,
   tracking string state (single, double, backtick) and escape
   sequences, incrementing/decrementing depth on `{`/`}`, returning
   the offset of the depth-zero close.

Tests verify the brace counter handles `}` characters embedded in
string literals.

### Wiring status (shipped 2026-05-07)

Items 1-3 below are now done in `feat/tauri-shell @ c7ffa20`:

1. ✅ **Type extension.** `Format::signature_cipher: Option<String>`
   added in `youtube_kernel/types.rs`.
2. ✅ **Pipeline integration.** `pick_audio` / `pick_video` return
   `PickedFormat { direct_url, signature_cipher, content_length,
   extension }`; the new `youtube_kernel::unlock_pipeline`
   module adds `try_audio_via_unlock` which asks the WEB client,
   fetches the watch page → jsUrl → player.js, builds an Unlocker
   on a `spawn_blocking` worker (boa Context is `!Send`), then
   feeds the unlocked URL to `download_stream`.
3. ✅ **Watch-page fetch + WEB client.** `fetch_player_js_for_video`
   is the one-shot helper; `clients::WEB` is the new ClientProfile.

Wired as a fallback layer in `run_download` for audio:
    try_audio_only (mobile/TV chain, plain URLs)
    → try_audio_via_unlock (WEB + signature/n-param decode)
    → try_combined (combined MP4, frontend remuxes)

### Outstanding: regex extractor tuning vs. modern player.js

Our 24 sigcipher unit tests pass against synthetic JS mimicking the
canonical shape (`X=function(a){a=a.split("");H.r(a);…;return
a.join("")};`). Captured real player.js (commit `c7ffa20`,
fixture `tests/fixtures/player_real.js` — gitignored, regenerate
locally):

* `8fb635c2/player_es6.vflset/en_US/base.js` (~2.4 MB) — Rick
  Roll watch page on 2026-05-07. Has a `signatureCipher` field on at
  least one format, so a sig decoder MUST be present in the JS, but
  our regex doesn't find it. Likely cause: heavily minified shapes
  YouTube has shifted to over the last 12-18 months that don't
  match yt-dlp's older heuristics. The `enhanced_except_` n-fn
  sentinel we anchor on is also absent from this particular
  player.js — YouTube has reworked the n-decoder shape too.

Practical impact: the unlock fallback fails on most modern videos
right now (with a clean error message); we fall through to
`try_combined` + frontend MediaExtractor remux, which is the
working Phase 1 path. **No regression vs. Phase 1.**

Next step (requires a chunk of focused work):

1. Capture multiple player.js variants (different videos / time
   windows) into `tests/fixtures/`.
2. Port yt-dlp's most recent regex from
   `yt_dlp/extractor/youtube/_video.py::_extract_signature_function`
   and the n-parameter equivalents.
3. Build a test that runs all current fixtures through the
   extractors; iterate the regex until they all pass.
4. Smoke test on a "no-PoToken" video (newer than what
   ANDROID_MUSIC will serve plain) on a connected device.

This is the same maintenance burden yt-dlp has — a regex update
roughly every 1-2 months on average. The kernel is wired so we can
absorb regex updates with one PR per cycle.

### Smoke testing the unlock path

```bash
# Run the manual fixture test (needs tests/fixtures/player_real.js):
cargo test --lib -- --ignored real_player_js --nocapture

# On device:
adb logcat -c && adb logcat | grep -E "patotube|youtubei"
# Trigger an audio download in the app on a video that fails
# the mobile chain. The "audio-only fast path failed" log should
# appear, then either "audio-only unlock path failed" (regex needs
# update) or success from the unlock route.
```

## Glossary

- **PoToken** ("Proof of Origin Token"): a short-lived token YouTube
  requires for some streams, computed via running their BotGuard JS
  attestation challenge. Out of scope for both phases — even yt-dlp
  doesn't compute it natively, requiring a separate plugin.
- **n-parameter**: a query parameter on every CDN URL whose value is
  a scrambled string. YouTube refuses streams where it isn't unscrambled
  via the JS function buried in `player.js`. Phase 2 unscrambles this.
- **signatureCipher**: the original (pre-2016) URL-protection
  mechanism. Some streams still use it instead of (or alongside) the
  n-parameter. Phase 2 also handles this.
- **itag**: YouTube's internal codec/quality identifier, e.g. itag
  140 = AAC ~128 kbps audio-only m4a, itag 18 = combined MP4 360p.

## How to verify Phase 1 works after a build

Smoke test on a connected device:

```bash
# Build
pnpm tauri android build --apk --target aarch64
# (then the symlink workaround documented in the main readme)

# Install
adb install -r app/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk

# Run + watch logs
adb logcat -c && adb logcat | grep -E "PatoMobileBridge|patotube"
```

In the app:

1. Pick a 5-min YouTube video. Choose Audio.
2. Watch the queue: status should go `downloading` → `converting` →
   `done`. The `converting` phase is the MediaExtractor remux.
3. Tap "open file" → music app opens the .m4a.
4. Open the same file in VLC → it should report **audio only, no
   video stream** (the regression from v0.1.1 is fixed).
5. The output file should be ~5–10 MB instead of ~50 MB (the
   ratio of audio-track bytes to total combined-stream bytes).

If the converting phase fails:

- Check logcat for the exception type from MediaExtractor or
  MediaMuxer
- Check the source .m4a is on disk via `adb shell ls -la /sdcard/Download/`
- If the file is there but remux fails, copy it to host with
  `adb pull` and re-run with ffmpeg manually to see if the source
  itself is malformed
