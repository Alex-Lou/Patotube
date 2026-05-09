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
// Default to the highest tier so users get the best quality
// out of the box; they can still pick a lower bitrate per
// download in the format picker.
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

/**
 * Single source of truth for "what file is the user actually going
 * to get". Drives both the queue-item line and the audio-only-mobile
 * info chip in the preview dialog. Format-only — the platform name
 * is shown separately by the caller (badge), so we don't repeat it.
 */
export function getResolvedFormatLabel(
  platform: PlatformId,
  format: FormatChoice,
  isAndroid: boolean,
  t: TFunc,
): string {
  if (format.kind === 'video') {
    return `MP4 · ${t(`format.${format.quality}`)}`;
  }

  // Audio. Each kernel ships its own native format — no transcoding
  // on Android, server-side encoding everywhere else.
  switch (platform) {
    case 'soundcloud':
      // SoundCloud serves MP3 server-side; bitrate isn't selectable.
      return 'MP3';
    case 'bandcamp':
      // Bandcamp's free preview tier is fixed at 128 kbps.
      return 'MP3 · 128k';
    case 'audiomack':
      return 'MP3';
    case 'archive':
      // Internet Archive items vary in container/codec; the actual
      // file extension on disk is the only honest answer.
      return t('format.audio');
    default:
      // YouTube and the generic / paywalled-platform fallbacks.
      // On Android we MediaExtractor-remux the AAC stream to a
      // bit-perfect M4A; on desktop yt-dlp + ffmpeg encodes to MP3
      // at the user-picked bitrate.
      return isAndroid ? 'M4A · AAC' : `MP3 · ${format.bitrate}k`;
  }
}
