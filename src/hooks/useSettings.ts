import { useCallback, useEffect, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { loadSettings, resetSettings, saveSettings } from '../services/storage';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setReady(true));
  }, []);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(current => {
        const next = { ...current, [key]: value };
        void saveSettings(next);
        return next;
      });
    },
    []
  );

  const replace = useCallback((next: AppSettings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const reset = useCallback(async () => {
    const next = await resetSettings();
    setSettings(next);
  }, []);

  return { settings, ready, update, replace, reset };
}
