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
