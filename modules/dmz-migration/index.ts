import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type WebViewPackageInfo = {
  packageName: string;
  versionName: string;
};

export type DisplayInfo = {
  currentRefreshRate: number;
  supportedRefreshRates: number[];
  width: number;
  height: number;
};

type DmzMigrationNative = {
  launchLegacyExperience(): Promise<boolean>;
  deactivateLegacyExperience(): Promise<boolean>;
  consumeLegacyExperienceReturn(): Promise<'v2' | null>;
  readPeerPayload(): Promise<string | null>;
  getDefaultWebViewUserAgent(): string | null;
  getWebViewPackage(): Promise<WebViewPackageInfo | null>;
  getDisplayInfo(): Promise<DisplayInfo | null>;
  clearWebViewData(): Promise<boolean>;
  syncWidgetSettings(selectedOperator: string): Promise<boolean>;
  requestPinDmzWidget(): Promise<boolean>;
  refreshDmzWidgets(): Promise<boolean>;
  installWebChromeParity(
    reactTag: number,
    animations: boolean,
    contentScale: number
  ): Promise<boolean>;
  setExportPayload(payload: string): Promise<boolean>;
};

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<DmzMigrationNative>('DmzMigration')
    : null;

export async function launchLegacyExperience(): Promise<boolean> {
  return nativeModule?.launchLegacyExperience() ?? false;
}

export async function deactivateLegacyExperience(): Promise<boolean> {
  return nativeModule?.deactivateLegacyExperience() ?? false;
}

export async function consumeLegacyExperienceReturn(): Promise<'v2' | null> {
  return nativeModule?.consumeLegacyExperienceReturn() ?? null;
}

export async function readPeerPayload(): Promise<string | null> {
  return nativeModule?.readPeerPayload() ?? null;
}

export function getDefaultWebViewUserAgent(): string | null {
  return nativeModule?.getDefaultWebViewUserAgent() ?? null;
}

export async function getWebViewPackage(): Promise<WebViewPackageInfo | null> {
  return nativeModule?.getWebViewPackage() ?? null;
}

export async function getDisplayInfo(): Promise<DisplayInfo | null> {
  return nativeModule?.getDisplayInfo() ?? null;
}

export async function clearWebViewData(): Promise<boolean> {
  return nativeModule?.clearWebViewData() ?? false;
}

export async function installWebChromeParity(
  reactTag: number,
  animations: boolean,
  contentScale: number
): Promise<boolean> {
  return nativeModule?.installWebChromeParity(
    reactTag,
    animations,
    contentScale
  ) ?? false;
}

export async function setExportPayload(payload: string): Promise<boolean> {
  return nativeModule?.setExportPayload(payload) ?? false;
}


export async function syncWidgetSettings(
  selectedOperator: string
): Promise<boolean> {
  return nativeModule?.syncWidgetSettings(selectedOperator) ?? false;
}

export async function requestPinDmzWidget(): Promise<boolean> {
  return nativeModule?.requestPinDmzWidget() ?? false;
}

export async function refreshDmzWidgets(): Promise<boolean> {
  return nativeModule?.refreshDmzWidgets() ?? false;
}
