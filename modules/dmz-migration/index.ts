import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type WebViewPackageInfo = {
  packageName: string;
  versionName: string;
};

type DmzMigrationNative = {
  readPeerPayload(): Promise<string | null>;
  getWebViewPackage(): Promise<WebViewPackageInfo | null>;
  clearWebViewData(): Promise<boolean>;
  setExportPayload(payload: string): Promise<boolean>;
};

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<DmzMigrationNative>('DmzMigration')
    : null;

export async function readPeerPayload(): Promise<string | null> {
  return nativeModule?.readPeerPayload() ?? null;
}

export async function getWebViewPackage(): Promise<WebViewPackageInfo | null> {
  return nativeModule?.getWebViewPackage() ?? null;
}

export async function clearWebViewData(): Promise<boolean> {
  return nativeModule?.clearWebViewData() ?? false;
}

export async function setExportPayload(payload: string): Promise<boolean> {
  return nativeModule?.setExportPayload(payload) ?? false;
}
