export type AppChannel = 'stable' | 'beta';

export type AppSettings = {
  desktopSite: boolean;
  verboseLoading: boolean;
  siteNotifications: boolean;
  pullToRefresh: boolean;
  rememberLastPage: boolean;
  appUiOverrides: boolean;
  lastPageUrl: string;
  selectedOperator: string;
  operatorVerified: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  desktopSite: false,
  verboseLoading: false,
  siteNotifications: true,
  pullToRefresh: true,
  rememberLastPage: true,
  appUiOverrides: true,
  lastPageUrl: 'https://dmzranked.com/',
  selectedOperator: '',
  operatorVerified: false
};

export type BridgeMessage =
  | { type: 'ready' }
  | { type: 'open-settings' }
  | { type: 'notification'; title?: string; body?: string }
  | { type: 'operator'; name?: string; verified?: boolean }
  | { type: 'log'; message?: string };
