import { useTranslation } from 'react-i18next';
import {
  Check,
  Languages,
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
} from 'lucide-react';
import { getTauri } from '@/lib/tauri/bindings';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme, type Theme } from '@/features/theme/theme-provider';
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@/features/i18n/i18n-config';
import { useSettings } from '@/lib/core/settings';
import {
  AUDIO_BITRATES,
  VIDEO_QUALITIES,
} from '@/lib/core/formats';
import type { AudioBitrate, VideoQuality } from '@/lib/core/types';

const REPO_URL = 'https://github.com/Alex-Lou/Patotube';
const APP_VERSION = '0.1.0';

export function SettingsMenu({ onAfterAction }: { onAfterAction?: () => void }) {
  const { i18n, t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { defaultFormat, setDefaultFormat, downloadFolder, setDownloadFolder } = useSettings();

  const pickFolder = async () => {
    const api = await getTauri();
    const picked = await api.pickFolder();
    if (picked) setDownloadFolder(picked);
  };

  const current = (i18n.resolvedLanguage ?? 'en') as Locale;

  const onPickLocale = (code: Locale) => {
    void i18n.changeLanguage(code);
    onAfterAction?.();
  };

  return (
    <div className="flex flex-col gap-7 mt-2 overflow-y-auto pr-1">
      {/* Language */}
      <Section icon={<Languages className="size-4" />} label={t('locale.language')}>
        <ul className="grid gap-1">
          {SUPPORTED_LOCALES.map((code) => {
            const meta = LOCALE_META[code];
            const active = code === current;
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => onPickLocale(code)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                    active
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'hover:bg-muted border border-transparent',
                  )}
                >
                  <span className="text-base leading-none shrink-0">{meta.flag}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 min-w-[28px] text-center',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {meta.abbr}
                  </span>
                  <span className="flex-1 truncate">{meta.native}</span>
                  {active && <Check className="size-4 shrink-0 opacity-80" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

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
          <p className="mt-2 text-[11px] text-muted-foreground">
            Currently {resolvedTheme}
          </p>
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
                quality:
                  defaultFormat.kind === 'video' ? defaultFormat.quality : 'best',
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
                bitrate:
                  defaultFormat.kind === 'audio' ? defaultFormat.bitrate : 192,
              })
            }
            icon={<Music className="size-4" />}
            label={t('format.audioMp3')}
          />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {defaultFormat.kind === 'video'
            ? VIDEO_QUALITIES.map((q) => (
                <PillButton
                  key={q}
                  active={defaultFormat.quality === q}
                  onClick={() =>
                    setDefaultFormat({ kind: 'video', quality: q as VideoQuality })
                  }
                >
                  {t(`format.${q}`)}
                </PillButton>
              ))
            : AUDIO_BITRATES.map((b) => (
                <PillButton
                  key={b}
                  active={defaultFormat.bitrate === b}
                  onClick={() =>
                    setDefaultFormat({ kind: 'audio', bitrate: b as AudioBitrate })
                  }
                >
                  {b}k
                </PillButton>
              ))}
        </div>
      </Section>

      {/* Download folder */}
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
            <Button
              variant="outline"
              size="sm"
              onClick={pickFolder}
              className="flex-1"
            >
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
