import type {
  AudioBitrate,
  FormatChoice,
  MediaKind,
  VideoQuality,
} from './types';

export const VIDEO_QUALITIES: readonly VideoQuality[] = ['best', 'high', 'medium', 'low'];
export const AUDIO_BITRATES: readonly AudioBitrate[] = [128, 192, 256, 320];

export const DEFAULT_VIDEO_QUALITY: VideoQuality = 'best';
export const DEFAULT_AUDIO_BITRATE: AudioBitrate = 192;

export const DEFAULT_FORMAT: FormatChoice = {
  kind: 'video',
  quality: DEFAULT_VIDEO_QUALITY,
};

export function makeFormat(kind: MediaKind): FormatChoice {
  return kind === 'video'
    ? { kind: 'video', quality: DEFAULT_VIDEO_QUALITY }
    : { kind: 'audio', bitrate: DEFAULT_AUDIO_BITRATE };
}
