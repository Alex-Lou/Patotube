import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormatChoice } from './types';
import { DEFAULT_FORMAT } from './formats';

interface SettingsState {
  defaultFormat: FormatChoice;
  setDefaultFormat: (format: FormatChoice) => void;
  reset: () => void;
}

const INITIAL = {
  defaultFormat: DEFAULT_FORMAT,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setDefaultFormat: (defaultFormat) => set({ defaultFormat }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'patotube-settings',
      version: 1,
    },
  ),
);
