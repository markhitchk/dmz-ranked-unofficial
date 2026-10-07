import { Platform } from 'react-native';
import * as Application from 'expo-application';
import SpInAppUpdates, {
  IAUInstallStatus,
  IAUUpdateKind,
  type StatusUpdateEvent
} from 'sp-react-native-in-app-updates';

const inAppUpdates = new SpInAppUpdates(false);

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

  const result = await inAppUpdates.checkNeedsUpdate({
    curVersion: current
  });

  if (result.shouldUpdate && startWhenAvailable) {
    if (Platform.OS === 'android') {
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
  inAppUpdates.addStatusUpdateListener(callback);
  return () => inAppUpdates.removeStatusUpdateListener(callback);
}

export function isDownloadedUpdate(event: StatusUpdateEvent): boolean {
  return event.status === IAUInstallStatus.DOWNLOADED;
}

export function installDownloadedUpdate(): void {
  if (Platform.OS === 'android') {
    inAppUpdates.installUpdate();
  }
}
