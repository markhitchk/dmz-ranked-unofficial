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
  developerMode: boolean;
  operatorAutoSave: boolean;
  webviewDebug: boolean;
  lastPageUrl: string;
  selectedOperator: string;
  operatorVerified: boolean;
  operatorProtected: boolean;
  operatorSource: string;
  operatorSyncMs: number;
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
  developerMode: false,
  operatorAutoSave: true,
  webviewDebug: false,
  lastPageUrl: 'https://dmzranked.com/',
  selectedOperator: '',
  operatorVerified: false,
  operatorProtected: false,
  operatorSource: '',
  operatorSyncMs: 0
};

export type BridgeMessage =
  | { type: 'ready' }
  | { type: 'app-ui-ready'; pageId: number }
  | { type: 'app-ui-error'; pageId: number; message?: string }
  | { type: 'open-settings'; target?: string }
  | { type: 'notification'; title?: string; body?: string }
  | {
      type: 'operator-alert-state';
      snapshot?: {
        playerId?: string;
        name?: string;
        reports?: number;
        raids?: Record<
          string,
          {
            reports?: number;
            pending?: boolean;
            verified?: boolean;
            pendingReason?: string;
          }
        >;
      };
    }
  | { type: 'back-result'; result?: string }
  | {
      type: 'operator';
      name?: string;
      verified?: boolean;
      protected?: boolean;
      statusVisible?: boolean;
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
  | {
      type: 'operator-restore-result';
      requestId?: string;
      result?: string;
    }
  | { type: 'log'; message?: string };
