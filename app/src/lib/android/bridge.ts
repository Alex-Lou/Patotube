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
  /** Lets Kotlin know if a <video>/<audio> element is currently
   *  playing — keeps the WebView alive while the app is in background. */
  setMediaPlaying(playing: boolean): void;
  /** "Listen in background" button: hand audio to a native Android
   *  MediaPlayer running in the foreground service. Survives screen
   *  lock, activity death, anything short of a force-stop. The UA
   *  must match the one Rust used to resolve the URL (googlevideo
   *  signs URLs against the client UA). videoId + thumbnailUrl are
   *  carried so the notif's "App" / "Floating" buttons can hand the
   *  exact same track back to the UI when the user wants to resume
   *  with a visible player. */
  startBackgroundAudio(
    url: string,
    userAgent: string,
    videoId: string,
    title: string,
    thumbnailUrl: string,
    positionMs: number,
  ): void;
  stopBackgroundAudio(): void;
  /** Live position of the native background player in ms, or -1 when
   *  no background session is alive. */
  getBackgroundPositionMs(): number;
}

interface BridgeCallbackResult {
  error: string;
}

export type PendingIntent =
  | { kind: 'download'; url: string }
  | { kind: 'open-file'; path: string }
  | {
      kind: 'resume-player';
      mode: 'dialog' | 'floating';
      videoId: string;
      title: string;
      thumbnailUrl: string;
      startAt: number;
    };

declare global {
  interface Window {
    PatoMobile?: PatoMobileBridge;
    // Name kept for historical reasons even though we no longer use ffmpeg.
    __patotubeFFmpegCallback?: (id: number, result: BridgeCallbackResult) => void;
    /** Push hook called by Kotlin after parking a fresh pending intent. */
    __patotubeOnIntent?: () => void;
    /** Called by the native foreground service when background-audio
     *  playback fails (network 403, codec refused, etc). Lets the UI
     *  surface a toast instead of dying silently. */
    __patotubeOnBgError?: (message: string) => void;
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

/** Notify the Kotlin side that a <video>/<audio> element changed
 *  playing state. Used to keep the WebView alive in background.
 *  Silent no-op when the native bridge isn't present (desktop /
 *  browser preview). */
export function setMediaPlayingNative(playing: boolean): void {
  try {
    window.PatoMobile?.setMediaPlaying?.(playing);
  } catch {
    /* old APKs without this binding — silent fallback */
  }
}

/** Attach play/pause/ended listeners to a <video> so the native
 *  bridge knows when media is live. Returns a cleanup function
 *  for the React effect's return value. */
export function bindMediaPlaybackNative(video: HTMLMediaElement | null): () => void {
  if (!video || !isAndroid()) return () => {};
  const onPlay = () => setMediaPlayingNative(true);
  const onPause = () => setMediaPlayingNative(false);
  video.addEventListener('play', onPlay);
  video.addEventListener('playing', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onPause);
  video.addEventListener('emptied', onPause);
  return () => {
    setMediaPlayingNative(false);
    video.removeEventListener('play', onPlay);
    video.removeEventListener('playing', onPlay);
    video.removeEventListener('pause', onPause);
    video.removeEventListener('ended', onPause);
    video.removeEventListener('emptied', onPause);
  };
}

// --- native background audio (MediaPlaybackService) ---------------

/** True when the native background player can take over playback. */
export const hasBackgroundAudio = (): boolean =>
  typeof window.PatoMobile?.startBackgroundAudio === 'function';

export interface BackgroundTrack {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

/** `url` + `userAgent` must come from the same Rust resolve:
 *  googlevideo signs the URL against the client UA. */
export function startBackgroundAudioNative(
  stream: { url: string; userAgent: string },
  track: BackgroundTrack,
  positionMs: number,
): void {
  window.PatoMobile!.startBackgroundAudio(
    stream.url,
    stream.userAgent,
    track.videoId,
    track.title,
    track.thumbnailUrl,
    Math.max(0, Math.floor(positionMs)),
  );
}

export function stopBackgroundAudioNative(): void {
  try {
    window.PatoMobile?.stopBackgroundAudio();
  } catch {
    /* bridge gone — nothing to stop */
  }
}

/** Live native position in ms, or null when no background session. */
export function backgroundPositionMsNative(): number | null {
  try {
    const ms = window.PatoMobile?.getBackgroundPositionMs?.();
    return typeof ms === 'number' && ms >= 0 ? ms : null;
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
