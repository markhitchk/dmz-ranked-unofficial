export type AppChannel = 'stable' | 'beta';
export type ContentSize = 'compact' | 'standard' | 'large';

export type AppSettings = {
  desktopSite: boolean;
  keepAwake: boolean;
  verboseLoading: boolean;
  siteNotifications: boolean;
  pullToRefresh: boolean;
  rememberLastPage: boolean;
  appUiOverrides: boolean;
  appAnimations: boolean;
  contentSize: ContentSize;
  operatorAutoSave: boolean;
  webviewDebug: boolean;
  lastPageUrl: string;
  selectedOperator: string;
  operatorVerified: boolean;
  operatorProtected: boolean;
  operatorSource: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  desktopSite: false,
  keepAwake: false,
  verboseLoading: false,
  siteNotifications: true,
  pullToRefresh: true,
  rememberLastPage: true,
  appUiOverrides: true,
  appAnimations: true,
  contentSize: 'standard',
  operatorAutoSave: true,
  webviewDebug: false,
  lastPageUrl: 'https://dmzranked.com/',
  selectedOperator: '',
  operatorVerified: false,
  operatorProtected: false,
  operatorSource: ''
};

export type BridgeMessage =
  | { type: 'ready' }
  | { type: 'open-settings' }
  | { type: 'notification'; title?: string; body?: string }
  | {
      type: 'operator';
      name?: string;
      verified?: boolean;
      protected?: boolean;
      source?: string;
    }
  | {
      type: 'operator-backup';
      name?: string;
      snapshot?: {
        origin?: string;
        storage?: Record<string, string>;
        protected?: boolean;
        verified?: boolean;
      };
    }
  | { type: 'log'; message?: string };
