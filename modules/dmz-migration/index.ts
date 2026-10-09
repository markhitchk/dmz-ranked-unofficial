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

export type UiPerformanceSample = {
  refreshRate: number;
  estimatedFps: number;
  averageFrameTimeMs: number;
  p95FrameTimeMs: number;
  jankPercent: number;
  missedFrames: number;
  sampleDurationMs: number;
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unavailable';
};

export type LegacyOperatorData = {
  operatorBackups: string;
  selectedOperator: string;
};

type DmzMigrationNative = {
  readPeerPayload(): Promise<string | null>;
  readLegacyOperatorData(): Promise<LegacyOperatorData | null>;
  getDefaultWebViewUserAgent(): string | null;
  getWebViewPackage(): Promise<WebViewPackageInfo | null>;
  getDisplayInfo(): Promise<DisplayInfo | null>;
  sampleUiPerformance(durationMs: number): Promise<UiPerformanceSample | null>;
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

export async function sampleUiPerformance(
  durationMs = 5000
): Promise<UiPerformanceSample | null> {
  return nativeModule?.sampleUiPerformance(durationMs) ?? null;
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
