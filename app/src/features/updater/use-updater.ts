import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isTauri } from '@/lib/tauri/bindings';

interface UpdaterState {
  checking: boolean;
  /** When non-null, an update is available. */
  available: { version: string; notes?: string } | null;
}

const SILENT_CHECK_KEY = 'patotube-last-update-check';
const CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Wraps tauri-plugin-updater. The plugin is desktop-only (Android does not
 * support self-updates in Tauri 2 yet); on mobile and in browser preview
 * everything no-ops.
 */
export function useUpdater() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    available: null,
  });
  const ranAutoCheck = useRef(false);

  const check = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!isTauri()) {
        if (!silent) toast.info(t('update.notInDesktop', 'Updates are checked from the desktop app.'));
        return;
      }
      setState((s) => ({ ...s, checking: true }));
      try {
        const { check: tauriCheck } = await import('@tauri-apps/plugin-updater');
        const update = await tauriCheck();
        if (!update?.available) {
          setState({ checking: false, available: null });
          if (!silent) toast.success(t('update.upToDate', 'You are up to date.'));
          return;
        }
        setState({
          checking: false,
          available: { version: update.version, notes: update.body ?? undefined },
        });
        toast.message(t('update.available', { version: update.version, defaultValue: 'Update available: v{{version}}' }), {
          description: update.body ?? undefined,
          duration: 12000,
          action: {
            label: t('update.installNow', 'Install now'),
            onClick: async () => {
              try {
                toast.loading(t('update.downloading', 'Downloading update…'), {
                  id: 'updater-download',
                });
                await update.downloadAndInstall();
                toast.dismiss('updater-download');
                const { relaunch } = await import('@tauri-apps/plugin-process');
                await relaunch();
              } catch (err) {
                toast.dismiss('updater-download');
                toast.error(t('update.failed', 'Update failed'), {
                  description: err instanceof Error ? err.message : String(err),
                });
              }
            },
          },
        });
      } catch (err) {
        setState({ checking: false, available: null });
        if (!silent) {
          toast.error(t('update.checkFailed', 'Update check failed'), {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
    [t],
  );

  // One silent auto-check on app start (with a 6h cooldown so we don't ping
  // GitHub on every relaunch).
  useEffect(() => {
    if (ranAutoCheck.current) return;
    ranAutoCheck.current = true;
    if (!isTauri()) return;

    const last = Number(localStorage.getItem(SILENT_CHECK_KEY) ?? '0');
    if (Date.now() - last < CHECK_COOLDOWN_MS) return;

    localStorage.setItem(SILENT_CHECK_KEY, String(Date.now()));
    void check({ silent: true });
  }, [check]);

  return { ...state, check };
}
