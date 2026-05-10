// Bridge to native Android Kotlin code. Wired up in MainActivity.kt
// via WebView.addJavascriptInterface — see PatoMobileBridge.kt.
//
// On desktop / browser dev these methods are absent, so every helper
// returns false (or no-ops) gracefully and callers fall back to the
// Tauri opener / clipboard paths.
//
// Audio post-processing (`remuxAudioOnly`) is async because the
// Kotlin side runs MediaExtractor / MediaMuxer on a worker thread
// and reports back via a global callback. See docs/youtube-kernel.md
// for the full design.

interface PatoMobileBridge {
  openFile(path: string): boolean;
  openDownloadsFolder(): boolean;
  scanFile(path: string): void;
  deleteFile(path: string): boolean;
  renameFile(srcPath: string, dstPath: string): boolean;
  shareFile(path: string): boolean;
  /** Read-and-clear the latest external Android intent forwarded
   *  by MainActivity. Returns a JSON string or null. JSON shapes:
   *  `{"kind":"download","url":"…"}` or
   *  `{"kind":"open-file","path":"…"}`. */
  consumePendingIntent(): string | null;
  /** Read a file into a base64 string. The embedded HTML5 player
   *  uses this on Android because Tauri's asset:// protocol tends
   *  to silently fail for arbitrary paths in the system WebView. */
  readFileBase64(path: string): string | null;
  // Async — returns void and calls
  // window.__patotubeFFmpegCallback(callbackId, { error: string })
  // when the remux finishes. error === "" means success.
  remuxAudioOnly(srcPath: string, dstPath: string, callbackId: number): void;
}

interface BridgeCallbackResult {
  error: string;
}

/** Decoded shape of `consumePendingIntent`. Either a download
 *  request (share-from-app or `patotube://download?url=…`) or an
 *  open-file request ("Open with → Patotube" or
 *  `patotube://open-file?path=…`). */
export type PendingIntent =
  | { kind: 'download'; url: string }
  | { kind: 'open-file'; path: string };

declare global {
  interface Window {
    PatoMobile?: PatoMobileBridge;
    // Name kept for historical reasons even though we no longer use
    // ffmpeg — renaming would force a coordinated bridge update.
    __patotubeFFmpegCallback?: (id: number, result: BridgeCallbackResult) => void;
    /** Push hook the Kotlin side calls after parking a fresh
     *  pending intent — saves the JS side from polling on a timer. */
    __patotubeOnIntent?: () => void;
  }
}

export const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

export const hasNativeBridge = (): boolean =>
  typeof window !== 'undefined' && !!window.PatoMobile;

/** True if the bridge advertises the audio post-processing method.
 *  Lets older APKs still get a sensible "skip post-process, deliver
 *  the source file as-is" path if we ever ship a build without the
 *  Kotlin remux for some reason. */
export const hasAudioRemuxBridge = (): boolean =>
  hasNativeBridge() && typeof window.PatoMobile?.remuxAudioOnly === 'function';

/** Try to open a file through Android's default app for its MIME type. */
export function openFileNative(path: string): boolean {
  return window.PatoMobile?.openFile(path) === true;
}

/** Bring up the system share sheet for a downloaded file. Returns
 *  false if the bridge is missing or the file no longer exists —
 *  caller can fall back to `navigator.share` or surface a toast. */
export function shareFileNative(path: string): boolean {
  try {
    return window.PatoMobile?.shareFile(path) === true;
  } catch {
    return false;
  }
}

/** Read-and-clear the latest external Android intent. Caller
 *  drives the loop: invoke on mount, on visibilitychange, and
 *  whenever `window.__patotubeOnIntent` fires (Kotlin push hook). */
export function consumePendingIntent(): PendingIntent | null {
  try {
    const raw = window.PatoMobile?.consumePendingIntent();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.kind === 'string') {
      return parsed as PendingIntent;
    }
  } catch {
    /* malformed payload — drop silently */
  }
  return null;
}

/** Read a file's bytes via the native bridge and wrap them in a
 *  Blob URL. Used by the embedded HTML5 player on Android, where
 *  Tauri's asset:// protocol doesn't reliably load arbitrary
 *  paths in the system WebView. Caller must `URL.revokeObjectURL`
 *  the returned URL when the player closes to free the memory. */
export function readAsBlobUrl(path: string, mime: string): string | null {
  try {
    const base64 = window.PatoMobile?.readFileBase64(path);
    if (!base64) return null;
    const binary = atob(base64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  } catch {
    return null;
  }
}

/** Open the system Downloads folder in the device's file picker / Files app. */
export function openDownloadsFolderNative(): boolean {
  return window.PatoMobile?.openDownloadsFolder() === true;
}

/** Tell Android's MediaScanner about a file we just wrote so it shows
 *  up in the Files / Music / Gallery apps without waiting for the
 *  periodic scan. */
export function scanFileNative(path: string): void {
  try {
    window.PatoMobile?.scanFile(path);
  } catch {
    /* noop */
  }
}

/** Delete a file via the native bridge. Best-effort; returns true if
 *  the file is gone after the call. */
export function deleteFileNative(path: string): boolean {
  try {
    return window.PatoMobile?.deleteFile(path) === true;
  } catch {
    return false;
  }
}

/** Rename a file via the native bridge. Overwrites the destination
 *  if it already exists. Best-effort; returns true if the source
 *  ended up at the destination. */
export function renameFileNative(srcPath: string, dstPath: string): boolean {
  try {
    return window.PatoMobile?.renameFile(srcPath, dstPath) === true;
  } catch {
    return false;
  }
}

// --- audio remux async bridge ------------------------------------

let nextCallbackId = 1;
const pendingCallbacks = new Map<number, (err: string) => void>();

// Install the global callback once. Idempotent: re-running the bundle
// (HMR) shouldn't re-bind, but if the WebView is recreated the new
// `window` object gets a fresh registration.
function ensureCallbackInstalled(): void {
  if (typeof window === 'undefined') return;
  if (window.__patotubeFFmpegCallback) return;
  window.__patotubeFFmpegCallback = (id, result) => {
    const cb = pendingCallbacks.get(id);
    if (cb) {
      pendingCallbacks.delete(id);
      cb(typeof result?.error === 'string' ? result.error : '');
    }
  };
}

interface BridgeCallOptions {
  /** Maximum time to wait for the bridge to finish before giving up.
   *  The callback is then evicted from the registry; if Kotlin reports
   *  back later it's silently ignored. Default 5 minutes. */
  timeoutMs?: number;
}

function callBridgeAsync(
  call: (callbackId: number) => void,
  opts: BridgeCallOptions = {},
): Promise<string> {
  ensureCallbackInstalled();
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;

  return new Promise<string>((resolve) => {
    const id = nextCallbackId++;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      pendingCallbacks.delete(id);
      resolve(`bridge call timed out after ${Math.round(timeoutMs / 1000)}s`);
    }, timeoutMs);

    pendingCallbacks.set(id, (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(err);
    });

    try {
      call(id);
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pendingCallbacks.delete(id);
      resolve(`bridge call threw: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

/** Strip the video track from `srcPath` and write a real audio-only
 *  file to `dstPath`, bit-perfect. Uses Android's built-in
 *  MediaExtractor + MediaMuxer — no third-party transcoder. Resolves
 *  with "" on success or an error message string on failure. */
export function remuxAudioOnlyAsync(
  srcPath: string,
  dstPath: string,
  opts?: BridgeCallOptions,
): Promise<string> {
  return callBridgeAsync(
    (id) => window.PatoMobile!.remuxAudioOnly(srcPath, dstPath, id),
    opts,
  );
}
