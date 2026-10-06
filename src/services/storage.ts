import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'dmz_ranked_settings_v2';

export async function loadSettings(): Promise<AppSettings> {
  const value = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!value) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function resetSettings(): Promise<AppSettings> {
  await AsyncStorage.removeItem(SETTINGS_KEY);
  return DEFAULT_SETTINGS;
}
