import { Youtube, Music2, AudioWaveform, Disc3, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { PlatformId } from '@/lib/core/types';
import { PLATFORMS } from '@/lib/core/platform';

const ICONS: Record<PlatformId, typeof Globe> = {
  youtube: Youtube,
  soundcloud: AudioWaveform,
  spotify: Music2,
  deezer: Disc3,
  generic: Globe,
};

export function PlatformBadge({ platform }: { platform: PlatformId }) {
  const { t } = useTranslation();
  const Icon = ICONS[platform];
  const info = PLATFORMS[platform];
  const isSoon = info.status === 'comingSoon';

  return (
    <Badge variant={isSoon ? 'soon' : 'default'} className="gap-1.5">
      <Icon className="size-3" />
      <span>{t(`platform.${platform}`)}</span>
      {isSoon && (
        <span className="ml-1 text-[10px] uppercase tracking-wide opacity-80">
          · {t('platform.comingSoon')}
        </span>
      )}
    </Badge>
  );
}
