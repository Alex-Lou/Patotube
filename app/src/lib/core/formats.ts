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
      // Server-side format, no bitrate choice: AAC (.m4a) over HLS for
      // most tracks today, MP3 on the few that still have progressive.
      return 'M4A · AAC';
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
