import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormatChoice } from './types';
import { DEFAULT_FORMAT } from './formats';

interface SettingsState {
  defaultFormat: FormatChoice;
  /** Custom download folder. When undefined, OS default Downloads dir is used. */
  downloadFolder?: string;
  setDefaultFormat: (format: FormatChoice) => void;
  setDownloadFolder: (folder: string | undefined) => void;
  reset: () => void;
}

const INITIAL = {
  defaultFormat: DEFAULT_FORMAT,
  downloadFolder: undefined,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setDefaultFormat: (defaultFormat) => set({ defaultFormat }),
      setDownloadFolder: (downloadFolder) => set({ downloadFolder }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'patotube-settings',
      version: 2,
    },
  ),
);
