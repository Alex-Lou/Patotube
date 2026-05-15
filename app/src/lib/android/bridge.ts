// Bridge to native Android Kotlin (PatoMobileBridge.kt). Absent on
// desktop/browser — helpers return false/no-op so callers fall back.
// remuxAudioOnly is async (Kotlin worker thread + global callback).

interface PatoMobileBridge {
  openFile(path: string): boolean;
  openDownloadsFolder(): boolean;
  scanFile(path: string): void;
  deleteFile(path: string): boolean;
  renameFile(srcPath: string, dstPath: string): boolean;
  shareFile(path: string): boolean;
  /** JSON: `{"kind":"download","url":…}` or `{"kind":"open-file","path":…}`. */
  consumePendingIntent(): string | null;
  /** asset:// protocol tends to silently fail on Android, so we read into base64. */
  readFileBase64(path: string): string | null;
  // Calls window.__patotubeFFmpegCallback(id, { error }) on completion (error === "" on success).
  remuxAudioOnly(srcPath: string, dstPath: string, callbackId: number): void;
}

interface BridgeCallbackResult {
  error: string;
}

export type PendingIntent =
  | { kind: 'download'; url: string }
  | { kind: 'open-file'; path: string };

declare global {
  interface Window {
    PatoMobile?: PatoMobileBridge;
    // Name kept for historical reasons even though we no longer use ffmpeg.
    __patotubeFFmpegCallback?: (id: number, result: BridgeCallbackResult) => void;
    /** Push hook called by Kotlin after parking a fresh pending intent. */
    __patotubeOnIntent?: () => void;
  }
}

export const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

export const hasNativeBridge = (): boolean =>
  typeof window !== 'undefined' && !!window.PatoMobile;

/** Lets older APKs fall back to "deliver source as-is" if remux is missing. */
export const hasAudioRemuxBridge = (): boolean =>
  hasNativeBridge() && typeof window.PatoMobile?.remuxAudioOnly === 'function';

export function openFileNative(path: string): boolean {
  return window.PatoMobile?.openFile(path) === true;
}

/** Returns false on missing bridge or vanished file — caller can fall back to navigator.share. */
export function shareFileNative(path: string): boolean {
  try {
    return window.PatoMobile?.shareFile(path) === true;
  } catch {
    return false;
  }
}

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

/** Workaround: asset:// protocol tends to silently fail on Android.
 *  Caller must URL.revokeObjectURL the returned URL. */
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

export function openDownloadsFolderNative(): boolean {
  return window.PatoMobile?.openDownloadsFolder() === true;
}

/** Notify MediaScanner so the file appears immediately in Files/Music/Gallery. */
export function scanFileNative(path: string): void {
  try {
    window.PatoMobile?.scanFile(path);
  } catch {
    /* noop */
  }
}

export function deleteFileNative(path: string): boolean {
  try {
    return window.PatoMobile?.deleteFile(path) === true;
  } catch {
    return false;
  }
}

/** Overwrites destination if it exists. */
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

// Idempotent: HMR doesn't re-bind, fresh WebView gets fresh registration.
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
  /** Default 5 minutes. Late Kotlin reports are silently ignored. */
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

/** Bit-perfect strip-video → audio-only via MediaExtractor+MediaMuxer.
 *  Resolves with "" on success or an error message string. */
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
