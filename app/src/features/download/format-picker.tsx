import { useTranslation } from 'react-i18next';
import { Music, Film, Info } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AUDIO_BITRATES,
  DEFAULT_AUDIO_BITRATE,
  VIDEO_QUALITIES,
  getResolvedFormatLabel,
} from '@/lib/core/formats';
import type {
  AudioBitrate,
  FormatChoice,
  PlatformId,
  VideoQuality,
} from '@/lib/core/types';
import { isAndroid } from '@/lib/android/bridge';

interface FormatPickerProps {
  value: FormatChoice;
  onChange: (next: FormatChoice) => void;
  /** When true, hide the video radio entirely. Used for
   *  audio-only platforms like SoundCloud where there's no
   *  video stream to choose. */
  audioOnly?: boolean;
  /** Needed to render the resolved-format info chip for
   *  audio-only platforms on mobile, where the user can't
   *  tweak bitrate. Optional so callers that don't pass a
   *  resolved platform get the existing behaviour. */
  platform?: PlatformId;
}

export function FormatPicker({
  value,
  onChange,
  audioOnly = false,
  platform,
}: FormatPickerProps) {
  const { t } = useTranslation();
  const onAndroid = isAndroid();

  const setKind = (kind: 'video' | 'audio') => {
    onChange(
      kind === 'video'
        ? { kind: 'video', quality: 'best' }
        : { kind: 'audio', bitrate: DEFAULT_AUDIO_BITRATE },
    );
  };

  return (
    <div className="space-y-4">
      {!audioOnly && (
        <RadioGroup
          value={value.kind}
          onValueChange={(v) => setKind(v as 'video' | 'audio')}
          className="grid grid-cols-2 gap-3"
        >
          <KindOption
            id="video"
            checked={value.kind === 'video'}
            icon={<Film className="size-4" />}
            label={t('format.videoMp4')}
          />
          <KindOption
            id="audio"
            checked={value.kind === 'audio'}
            icon={<Music className="size-4" />}
            label={onAndroid ? t('format.audioM4a') : t('format.audioMp3')}
          />
        </RadioGroup>
      )}

      {value.kind === 'video' ? (
        <div className="space-y-1.5">
          <Label htmlFor="video-quality">{t('format.quality')}</Label>
          <Select
            value={value.quality}
            onValueChange={(q) => onChange({ kind: 'video', quality: q as VideoQuality })}
          >
            <SelectTrigger id="video-quality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_QUALITIES.map((q) => (
                <SelectItem key={q} value={q}>
                  {t(`format.${q}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : audioOnly && onAndroid && platform ? (
        // Audio-only mobile (Bandcamp / SoundCloud / Audiomack):
        // there's nothing to choose — the kernel hands us the
        // platform's native encoding — but we still owe the user
        // a clear "this is what you'll get" line so the section
        // doesn't render empty under the FORMAT heading.
        <FormatInfoChip label={getResolvedFormatLabel(platform, value, onAndroid, t)} />
      ) : onAndroid ? (
        // YouTube hands one fixed-bitrate AAC stream per video; on
        // mobile we don't transcode (MediaExtractor remux is
        // bit-perfect, no LAME on the device). Showing a 128/192/256/
        // 320 picker would be a lie. See docs/youtube-kernel.md.
        <FormatInfoChip label={t('format.audioMobileNote')} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="audio-bitrate">{t('format.audioBitrate')}</Label>
          <Select
            value={String(value.bitrate)}
            onValueChange={(b) =>
              onChange({ kind: 'audio', bitrate: Number(b) as AudioBitrate })
            }
          >
            <SelectTrigger id="audio-bitrate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_BITRATES.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {t('format.kbps', { value: b })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/** Read-only info row used when there's nothing to pick (audio-only
 *  on mobile, YouTube AAC mobile note). Same chrome both places. */
function FormatInfoChip({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
      <Info className="size-3.5 mt-0.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function KindOption({
  id,
  checked,
  icon,
  label,
}: {
  id: string;
  checked: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors',
        'hover:border-primary/50',
        checked && 'border-primary bg-primary/5',
      )}
    >
      <RadioGroupItem id={id} value={id} className="shrink-0" />
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Label>
  );
}
