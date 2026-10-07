import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { readPeerPayload, setExportPayload } from '../../modules/dmz-migration';
import {
  exportOperatorBackups,
  importOperatorBackups
} from './operatorBackup';
import type { AppSettings } from '../types';

type LegacyPreferences = Record<string, boolean | number | string>;

export type PeerImportResult = {
  sourcePackage: string;
  patch: Partial<AppSettings>;
  importedOperators: number;
};

const PRODUCTION_MIGRATION_KEY = 'dmz_production_migration_v1';

function toPatch(preferences: LegacyPreferences): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};

  if (typeof preferences.desktop_site === 'boolean') {
    patch.desktopSite = preferences.desktop_site;
  }
  if (typeof preferences.keep_awake === 'boolean') {
    patch.keepAwake = preferences.keep_awake;
  }
  if (typeof preferences.verbose_loading === 'boolean') {
    patch.verboseLoading = preferences.verbose_loading;
  }
  if (typeof preferences.site_notifications === 'boolean') {
    patch.siteNotifications = preferences.site_notifications;
  }
  if (typeof preferences.pull_to_refresh === 'boolean') {
    patch.pullToRefresh = preferences.pull_to_refresh;
  }
  if (typeof preferences.remember_last_page === 'boolean') {
    patch.rememberLastPage = preferences.remember_last_page;
  }
  if (typeof preferences.last_page_url === 'string') {
    patch.lastPageUrl = preferences.last_page_url;
  }
  if (typeof preferences.website_selected_operator === 'string') {
    patch.selectedOperator = preferences.website_selected_operator;
  }
  if (typeof preferences.website_operator_verified === 'boolean') {
    patch.operatorVerified = preferences.website_operator_verified;
  }
  if (typeof preferences.website_operator_protected === 'boolean') {
    patch.operatorProtected = preferences.website_operator_protected;
  }
  if (typeof preferences.website_operator_source === 'string') {
    patch.operatorSource = preferences.website_operator_source;
  }
  if (typeof preferences.operator_auto_save === 'boolean') {
    patch.operatorAutoSave = preferences.operator_auto_save;
  }
  if (
    preferences.content_size === 'compact' ||
    preferences.content_size === 'standard' ||
    preferences.content_size === 'large'
  ) {
    patch.contentSize = preferences.content_size;
  }
  if (typeof preferences.app_animations === 'boolean') {
    patch.appAnimations = preferences.app_animations;
  }
  if (typeof preferences.webview_debug === 'boolean') {
    patch.webviewDebug = preferences.webview_debug;
  }

  return patch;
}

export async function importFromPeer(): Promise<PeerImportResult | null> {
  const raw = await readPeerPayload();
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as {
      sourcePackage?: string;
      preferences?: LegacyPreferences;
      operatorBackups?: string;
    };

    const importedOperators = payload.operatorBackups
      ? await importOperatorBackups(payload.operatorBackups)
      : 0;

    return {
      sourcePackage: payload.sourcePackage ?? 'DMZ Ranked',
      patch: toPatch(payload.preferences ?? {}),
      importedOperators
    };
  } catch {
    return null;
  }
}

export async function publishMigrationPayload(
  settings: AppSettings
): Promise<boolean> {
  const preferences: LegacyPreferences = {
    desktop_site: settings.desktopSite,
    keep_awake: settings.keepAwake,
    verbose_loading: settings.verboseLoading,
    site_notifications: settings.siteNotifications,
    pull_to_refresh: settings.pullToRefresh,
    remember_last_page: settings.rememberLastPage,
    last_page_url: settings.lastPageUrl,
    website_selected_operator: settings.selectedOperator,
    website_operator_verified: settings.operatorVerified,
    website_operator_protected: settings.operatorProtected,
    website_operator_source: settings.operatorSource,
    operator_auto_save: settings.operatorAutoSave,
    content_size: settings.contentSize,
    app_animations: settings.appAnimations,
    webview_debug: settings.webviewDebug
  };

  const payload = JSON.stringify({
    sourcePackage: Application.applicationId ?? '',
    preferences,
    operatorBackups: await exportOperatorBackups()
  });

  return await setExportPayload(payload);
}


export async function autoImportProductionToBeta(): Promise<PeerImportResult | null> {
  if (!(Application.applicationId ?? '').endsWith('.beta')) return null;
  if ((await AsyncStorage.getItem(PRODUCTION_MIGRATION_KEY)) === '1') return null;

  const imported = await importFromPeer();
  if (!imported) return null;

  await AsyncStorage.setItem(PRODUCTION_MIGRATION_KEY, '1');
  return imported;
}


export async function resetProductionMigrationState(): Promise<void> {
  await AsyncStorage.removeItem(PRODUCTION_MIGRATION_KEY);
}
