export type PlatformId =
  | 'youtube'
  | 'soundcloud'
  | 'spotify'
  | 'deezer'
  | 'generic';

export type PlatformStatus = 'active' | 'comingSoon';

export interface PlatformInfo {
  id: PlatformId;
  status: PlatformStatus;
  hostnames: readonly string[];
}

export type MediaKind = 'video' | 'audio';

export type VideoQuality = 'best' | 'high' | 'medium' | 'low';
export type AudioBitrate = 128 | 192 | 256 | 320;

export interface VideoFormatChoice {
  kind: 'video';
  quality: VideoQuality;
}

export interface AudioFormatChoice {
  kind: 'audio';
  bitrate: AudioBitrate;
}

export type FormatChoice = VideoFormatChoice | AudioFormatChoice;

export interface MediaInfo {
  url: string;
  title: string;
  uploader?: string;
  durationSec?: number;
  thumbnail?: string;
  platform: PlatformId;
}

export type JobStatus =
  | 'pending'
  | 'downloading'
  | 'converting'
  | 'done'
  | 'failed';

export interface DownloadJob {
  id: string;
  info: MediaInfo;
  format: FormatChoice;
  status: JobStatus;
  progress: number;
  speedBps?: number;
  etaSec?: number;
  filePath?: string;
  error?: string;
  createdAt: number;
}
