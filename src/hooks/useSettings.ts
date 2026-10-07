import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { loadSettings, resetSettings, saveSettings } from '../services/storage';
import { resetNotificationSyncState } from '../services/backgroundNotificationSync';
import { resetProductionMigrationState } from '../services/peerMigration';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: AppSettings) => {
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveSettings(next));
  }, []);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(current => {
        const next = { ...current, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const replace = useCallback((next: AppSettings) => {
    setSettings(next);
    persist(next);
  }, [persist]);

  const reset = useCallback(async () => {
    await saveQueue.current.catch(() => undefined);
    const next = await resetSettings();
    await Promise.all([
      resetNotificationSyncState(),
      resetProductionMigrationState()
    ]);
    setSettings(next);
  }, []);

  return { settings, ready, update, replace, reset };
}
