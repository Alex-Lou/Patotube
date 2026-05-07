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
  VIDEO_QUALITIES,
} from '@/lib/core/formats';
import type {
  AudioBitrate,
  FormatChoice,
  VideoQuality,
} from '@/lib/core/types';
import { isAndroid } from '@/lib/android/bridge';

interface FormatPickerProps {
  value: FormatChoice;
  onChange: (next: FormatChoice) => void;
}

export function FormatPicker({ value, onChange }: FormatPickerProps) {
  const { t } = useTranslation();
  const onAndroid = isAndroid();

  const setKind = (kind: 'video' | 'audio') => {
    onChange(
      kind === 'video'
        ? { kind: 'video', quality: 'best' }
        : { kind: 'audio', bitrate: 192 },
    );
  };

  return (
    <div className="space-y-4">
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
      ) : onAndroid ? (
        // YouTube hands one fixed-bitrate AAC stream per video; on
        // mobile we don't transcode (MediaExtractor remux is
        // bit-perfect, no LAME on the device). Showing a 128/192/256/
        // 320 picker would be a lie. See docs/youtube-kernel.md.
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>{t('format.audioMobileNote')}</span>
        </div>
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
