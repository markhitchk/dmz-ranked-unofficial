import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type DmzMigrationNative = {
  readPeerPayload(): Promise<string | null>;
  setExportPayload(payload: string): Promise<boolean>;
};

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<DmzMigrationNative>('DmzMigration')
    : null;

export async function readPeerPayload(): Promise<string | null> {
  return nativeModule?.readPeerPayload() ?? null;
}

export async function setExportPayload(payload: string): Promise<boolean> {
  return nativeModule?.setExportPayload(payload) ?? false;
}
