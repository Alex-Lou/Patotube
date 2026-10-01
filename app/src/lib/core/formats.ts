import type {
  AudioBitrate,
  FormatChoice,
  MediaKind,
  PlatformId,
  VideoQuality,
} from './types';

export const VIDEO_QUALITIES: readonly VideoQuality[] = ['best', 'high', 'medium', 'low'];
export const AUDIO_BITRATES: readonly AudioBitrate[] = [128, 192, 256, 320];

export const DEFAULT_VIDEO_QUALITY: VideoQuality = 'best';
// Highest tier by default; overridable per-download.
export const DEFAULT_AUDIO_BITRATE: AudioBitrate = 320;

export const DEFAULT_FORMAT: FormatChoice = {
  kind: 'video',
  quality: DEFAULT_VIDEO_QUALITY,
};

export function makeFormat(kind: MediaKind): FormatChoice {
  return kind === 'video'
    ? { kind: 'video', quality: DEFAULT_VIDEO_QUALITY }
    : { kind: 'audio', bitrate: DEFAULT_AUDIO_BITRATE };
}

type TFunc = (key: string, params?: Record<string, unknown>) => string;

/** Resolved-file label (no platform name; caller renders the badge). */
export function getResolvedFormatLabel(
  platform: PlatformId,
  format: FormatChoice,
  isAndroid: boolean,
  t: TFunc,
): string {
  if (format.kind === 'video') {
    return `MP4 · ${t(`format.${format.quality}`)}`;
  }

  // Android: bit-perfect MediaExtractor remux. Desktop: yt-dlp + ffmpeg encode.
  switch (platform) {
    case 'soundcloud':
      // Server-side MP3, no bitrate choice.
      return 'MP3';
    case 'bandcamp':
      // Free preview tier is fixed 128 kbps.
      return 'MP3 · 128k';
    case 'audiomack':
      return 'MP3';
    case 'archive':
      // Container/codec varies; the on-disk extension is the only honest answer.
      return t('format.audio');
    default:
      return isAndroid ? 'M4A · AAC' : `MP3 · ${format.bitrate}k`;
  }
}

/** Above this, the preview warns that the download will take a while. */
export const LONG_MEDIA_SECONDS = 60 * 60;

// Typical total bitrate (video + audio, bits/s) YouTube serves for each
// quality cap. Only used for a rough size hint, never for logic.
const VIDEO_BITRATE_BPS: Record<VideoQuality, number> = {
  best: 5_000_000,
  high: 3_000_000,
  medium: 1_800_000,
  low: 1_000_000,
};
// Android keeps YouTube's AAC stream (~128 kbps) whatever bitrate is picked.
const ANDROID_AUDIO_BPS = 128_000;

/** Rough output size in bytes for a media of `durationSec`, or null when
 *  the duration is unknown. An estimate: real files vary by ±50 %. */
export function estimateSizeBytes(
  durationSec: number | undefined,
  format: FormatChoice,
  isAndroid: boolean,
): number | null {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return null;
  }
  const bps =
    format.kind === 'video'
      ? VIDEO_BITRATE_BPS[format.quality]
      : isAndroid
        ? ANDROID_AUDIO_BPS
        : format.bitrate * 1000;
  return Math.round((bps / 8) * durationSec);
}
