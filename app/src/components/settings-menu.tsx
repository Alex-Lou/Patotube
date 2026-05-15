import { useTranslation } from 'react-i18next';
import {
  Moon,
  Palette,
  Sun,
  Github,
  Film,
  Music,
  Monitor,
  Folder,
  FolderCog,
  RotateCcw,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useUpdater } from '@/features/updater/use-updater';
import { getTauri } from '@/lib/tauri/bindings';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/features/theme/theme-provider';
import { useSettings } from '@/lib/core/settings';
import { AUDIO_BITRATES, DEFAULT_AUDIO_BITRATE, VIDEO_QUALITIES } from '@/lib/core/formats';
import type { AudioBitrate, VideoQuality } from '@/lib/core/types';
import { isAndroid } from '@/lib/android/bridge';

// Several rows hidden on Android: native extractor writes to /sdcard/Download,
// no updater plugin, no audio bitrate (MediaExtractor remux).

const REPO_URL = 'https://github.com/Alex-Lou/Patotube';
const APP_VERSION = '0.2.0';

export function SettingsMenu(_props: { onAfterAction?: () => void }) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { defaultFormat, setDefaultFormat, downloadFolder, setDownloadFolder } = useSettings();
  const { checking, available, check } = useUpdater();
  const onAndroid = isAndroid();

  const pickFolder = async () => {
    const api = await getTauri();
    const picked = await api.pickFolder();
    if (picked) setDownloadFolder(picked);
  };

  return (
    <div className="flex flex-col gap-7 mt-2 overflow-y-auto pr-1">
      {/* Theme */}
      <Section icon={<Palette className="size-4" />} label={t('settings.theme')}>
        <div className="grid grid-cols-3 gap-2">
          <ChoiceTile
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            icon={<Sun className="size-4" />}
            label="Light"
          />
          <ChoiceTile
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            icon={<Moon className="size-4" />}
            label="Dark"
          />
          <ChoiceTile
            active={theme === 'system'}
            onClick={() => setTheme('system')}
            icon={<Monitor className="size-4" />}
            label="Auto"
          />
        </div>
        {theme === 'system' && (
          <p className="mt-2 text-[11px] text-muted-foreground">Currently {resolvedTheme}</p>
        )}
      </Section>

      {/* Default format */}
      <Section icon={<Film className="size-4" />} label={t('format.label')}>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceTile
            active={defaultFormat.kind === 'video'}
            onClick={() =>
              setDefaultFormat({
                kind: 'video',
                quality: defaultFormat.kind === 'video' ? defaultFormat.quality : 'best',
              })
            }
            icon={<Film className="size-4" />}
            label={t('format.videoMp4')}
          />
          <ChoiceTile
            active={defaultFormat.kind === 'audio'}
            onClick={() =>
              setDefaultFormat({
                kind: 'audio',
                bitrate: defaultFormat.kind === 'audio' ? defaultFormat.bitrate : DEFAULT_AUDIO_BITRATE,
              })
            }
            icon={<Music className="size-4" />}
            label={onAndroid ? t('format.audioM4a') : t('format.audioMp3')}
          />
        </div>

        {defaultFormat.kind === 'video' ? (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {VIDEO_QUALITIES.map((q) => (
              <PillButton
                key={q}
                active={defaultFormat.quality === q}
                onClick={() => setDefaultFormat({ kind: 'video', quality: q as VideoQuality })}
              >
                {t(`format.${q}`)}
              </PillButton>
            ))}
          </div>
        ) : onAndroid ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t('format.audioMobileNote')}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {AUDIO_BITRATES.map((b) => (
              <PillButton
                key={b}
                active={defaultFormat.bitrate === b}
                onClick={() => setDefaultFormat({ kind: 'audio', bitrate: b as AudioBitrate })}
              >
                {b}k
              </PillButton>
            ))}
          </div>
        )}
      </Section>

      {!onAndroid && (
        <Section icon={<Folder className="size-4" />} label={t('settings.downloadFolder')}>
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-muted/40"
              title={downloadFolder ?? t('settings.osDefault')}
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-mono text-muted-foreground">
                {downloadFolder ?? t('settings.osDefault')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={pickFolder} className="flex-1">
                <FolderCog className="size-4" />
                {t('settings.browse')}
              </Button>
              {downloadFolder && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDownloadFolder(undefined)}
                  aria-label={t('settings.osDefault')}
                  title={t('settings.osDefault')}
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </Section>
      )}

      {!onAndroid && (
        <Section icon={<RefreshCw className="size-4" />} label={t('update.section', 'Updates')}>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void check({ silent: false })}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {checking
              ? t('update.checking', 'Checking…')
              : available
                ? t('update.available', { version: available.version })
                : t('update.checkButton', 'Check for updates')}
          </Button>
        </Section>
      )}

      {/* About */}
      <Section icon={<Github className="size-4" />} label={t('settings.about')}>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-muted border border-transparent hover:border-border/60 transition-colors"
        >
          <span>GitHub</span>
          <span className="text-xs text-muted-foreground font-mono">v{APP_VERSION}</span>
        </a>
      </Section>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ChoiceTile({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary border border-primary/30'
          : 'border border-border/60 hover:border-primary/40 hover:bg-muted',
      )}
    >
      <span>{icon}</span>
      <span className="truncate max-w-full">{label}</span>
    </button>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 rounded-md text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent hover:border-border',
      )}
    >
      {children}
    </button>
  );
}
