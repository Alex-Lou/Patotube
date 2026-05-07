// Bridge to native Android Kotlin code. Wired up in MainActivity.kt
// via WebView.addJavascriptInterface — see PatoMobileBridge.kt.
//
// On desktop / browser dev these methods are absent, so every helper
// returns false (or no-ops) gracefully and callers fall back to the
// Tauri opener / clipboard paths.

interface PatoMobileBridge {
  openFile(path: string): boolean;
  openDownloadsFolder(): boolean;
  scanFile(path: string): void;
}

declare global {
  interface Window {
    PatoMobile?: PatoMobileBridge;
  }
}

export const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

export const hasNativeBridge = (): boolean =>
  typeof window !== 'undefined' && !!window.PatoMobile;

/** Try to open a file through Android's default app for its MIME type. */
export function openFileNative(path: string): boolean {
  return window.PatoMobile?.openFile(path) === true;
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
