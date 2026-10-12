import { Platform } from 'react-native';
import * as Application from 'expo-application';
import type { StatusUpdateEvent } from 'sp-react-native-in-app-updates';

// These numeric values are the public AndroidInstallStatus API from
// sp-react-native-in-app-updates. Do not import its runtime module here:
// it calls TurboModuleRegistry.getEnforcing during module evaluation.
const IAUInstallStatus = {
  PENDING: 1,
  DOWNLOADING: 2,
  INSTALLING: 3,
  INSTALLED: 4,
  FAILED: 5,
  CANCELED: 6,
  DOWNLOADED: 11
} as const;

type InAppUpdatesManager = InstanceType<
  (typeof import('sp-react-native-in-app-updates'))['default']
>;

let managerPromise: Promise<InAppUpdatesManager> | null = null;

function getInAppUpdates(): Promise<InAppUpdatesManager> {
  if (!managerPromise) {
    // Lazily initialize the Play update integration. A missing/incompatible
    // native TurboModule must reject this feature, not crash the whole app
    // before AppErrorBoundary is mounted.
    managerPromise = import('sp-react-native-in-app-updates')
      .then(({ default: SpInAppUpdates }) => new SpInAppUpdates(false))
      .catch(error => {
        managerPromise = null;
        throw error;
      });
  }
  return managerPromise;
}

export type AppUpdateCheck = {
  available: boolean;
  storeVersion?: string;
  reason?: string;
};

export function installedVersionLabel(): string {
  const version = Application.nativeApplicationVersion ?? 'Unknown';
  const build = Application.nativeBuildVersion ?? 'Unknown';
  return `Installed ${version} (${build})`;
}

export function appUpdateStatusText(event: StatusUpdateEvent): string {
  switch (event.status) {
    case IAUInstallStatus.PENDING:
      return 'Preparing Google Play update…';
    case IAUInstallStatus.DOWNLOADING: {
      const downloaded = Math.max(0, Number(event.bytesDownloaded) || 0);
      const total = Math.max(0, Number(event.totalBytesToDownload) || 0);
      if (total > 0) {
        const percent = Math.max(
          0,
          Math.min(100, Math.round((downloaded * 100) / total))
        );
        return `Downloading update from Google Play… ${percent}%`;
      }
      return 'Downloading update from Google Play…';
    }
    case IAUInstallStatus.DOWNLOADED:
      return 'Update downloaded from Google Play • Ready to install.';
    case IAUInstallStatus.INSTALLING:
      return 'Installing Google Play update…';
    case IAUInstallStatus.INSTALLED:
      return 'Update installed • refreshing Google Play status…';
    case IAUInstallStatus.FAILED:
      return 'Google Play update failed • Tap CHECK to retry.';
    case IAUInstallStatus.CANCELED:
      return 'Update canceled • Tap CHECK to retry.';
    default:
      return installedVersionLabel() + ' • Live monitoring';
  }
}

export async function checkForAppUpdate(
  startWhenAvailable: boolean
): Promise<AppUpdateCheck> {
  const current =
    Platform.OS === 'android'
      ? Application.nativeBuildVersion ?? '0'
      : Application.nativeApplicationVersion ?? '0.0.0';

  const inAppUpdates = await getInAppUpdates();
  const result = await inAppUpdates.checkNeedsUpdate({
    curVersion: current
  });

  if (result.shouldUpdate && startWhenAvailable) {
    if (Platform.OS === 'android') {
      const { IAUUpdateKind } = await import('sp-react-native-in-app-updates');
      await inAppUpdates.startUpdate({
        updateType: IAUUpdateKind.FLEXIBLE
      });
    } else {
      await inAppUpdates.startUpdate({
        title: 'Update available',
        message:
          'There is a newer DMZ Ranked app version available. Would you like to update it?',
        buttonUpgradeText: 'Update',
        buttonCancelText: 'Cancel'
      });
    }
  }

  return {
    available: Boolean(result.shouldUpdate),
    storeVersion: result.storeVersion,
    reason: result.reason
  };
}

export function listenForAppUpdateStatus(
  callback: (event: StatusUpdateEvent) => void
): () => void {
  if (Platform.OS !== 'android') return () => undefined;
  let active = true;
  let subscribed: InAppUpdatesManager | null = null;
  void getInAppUpdates()
    .then(manager => {
      if (!active) return;
      manager.addStatusUpdateListener(callback);
      subscribed = manager;
    })
    .catch(error => {
      console.warn('DMZ Ranked: Play update listener unavailable', error);
    });

  return () => {
    active = false;
    try {
      subscribed?.removeStatusUpdateListener(callback);
    } catch (error) {
      console.warn('DMZ Ranked: could not remove Play update listener', error);
    }
  };
}

export function isDownloadedUpdate(event: StatusUpdateEvent): boolean {
  return event.status === IAUInstallStatus.DOWNLOADED;
}

export function installDownloadedUpdate(): void {
  if (Platform.OS !== 'android') return;
  void getInAppUpdates()
    .then(manager => manager.installUpdate())
    .catch(error => {
      console.warn('DMZ Ranked: Play update install unavailable', error);
    });
}
