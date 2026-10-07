import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  ToastAndroid,
  View
} from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as KeepAwake from 'expo-keep-awake';
import NetInfo from '@react-native-community/netinfo';
import {
  requestPinWidget,
  requestWidgetUpdate
} from 'react-native-android-widget';
import { AppHeader } from './components/AppHeader';
import { DmzDialog } from './components/DmzDialog';
import { FeedbackPanel } from './components/FeedbackPanel';
import {
  SettingsPanel,
  type SettingsAction
} from './components/SettingsPanel';
import {
  DmzWebScreen,
  type DmzWebHandle
} from './screens/DmzWebScreen';
import { useSettings } from './hooks/useSettings';
import {
  initializeNotifications,
  showWebsiteNotification
} from './services/notifications';
import {
  configureBackgroundNotifications,
  primeNotificationBaseline,
  scheduleNotificationBackgroundKick,
  setNotificationAppForeground
} from './services/backgroundNotificationSync';
import {
  appUpdateStatusText,
  checkForAppUpdate,
  installDownloadedUpdate,
  installedVersionLabel,
  isDownloadedUpdate,
  listenForAppUpdateStatus
} from './services/appUpdates';
import {
  autoImportProductionToBeta,
  importFromPeer,
  publishMigrationPayload
} from './services/peerMigration';
import { renderDmzWidget } from './widgets/widgetTaskHandler';
import { colors, contentScaleFactor } from './theme';
import type { AppChannel } from './types';
import { AppSafeArea } from './components/AppSafeArea';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { clearWebViewData } from '../modules/dmz-migration';

const PLAY_PACKAGE_STABLE = 'com.harleytg.dmzranked';
const PLAY_PACKAGE_BETA = 'com.harleytg.dmzranked.beta';

type AppDialog = {
  title: string;
  message: string;
  positiveLabel?: string;
  negativeLabel?: string;
  onPositive?: () => void;
} | null;

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}

function AppContent() {
  const { settings, ready, update, replace, reset } = useSettings();
  const webRef = useRef<DmzWebHandle>(null);
  const appState = useRef(AppState.currentState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [backupRevision, setBackupRevision] = useState(0);
  const [appDialog, setAppDialog] = useState<AppDialog>(null);
  const [updateStatus, setUpdateStatus] = useState(
    installedVersionLabel() + ' • Live monitoring'
  );
  const lastAnnouncedStoreVersion = useRef('');

  const channel =
    (Constants.expoConfig?.extra?.appChannel as AppChannel | undefined) ??
    'stable';

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(Boolean(state.isConnected));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!ready) return;

    void initializeNotifications(settings.siteNotifications);
    void configureBackgroundNotifications(settings.siteNotifications);
    void setNotificationAppForeground(AppState.currentState === 'active');

    if (settings.siteNotifications) {
      void primeNotificationBaseline();
    }
  }, [ready, settings.siteNotifications]);

  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', nextState => {
      const wasActive = appState.current === 'active';
      const isActive = nextState === 'active';
      appState.current = nextState;
      void setNotificationAppForeground(isActive);

      if (!settings.siteNotifications) return;
      if (isActive) {
        void configureBackgroundNotifications(true);
        void primeNotificationBaseline();
      } else if (wasActive) {
        scheduleNotificationBackgroundKick();
      }
    });
    return () => subscription.remove();
  }, [ready, settings.siteNotifications]);

  useEffect(() => {
    const tag = 'dmz-ranked-app';
    if (settings.keepAwake) {
      void KeepAwake.activateKeepAwakeAsync(tag);
    } else {
      void KeepAwake.deactivateKeepAwake(tag);
    }

    return () => {
      void KeepAwake.deactivateKeepAwake(tag);
    };
  }, [settings.keepAwake]);

  useEffect(() => {
    if (!ready || channel !== 'beta' || Platform.OS !== 'android') return;
    void autoImportProductionToBeta().then(imported => {
      if (!imported) return;
      replace({ ...settings, ...imported.patch });
      setBackupRevision(value => value + 1);
      ToastAndroid.show(
        imported.importedOperators > 0
          ? 'Imported app settings and operator backups from DMZ Ranked.'
          : 'Imported app settings from DMZ Ranked.',
        ToastAndroid.LONG
      );
    });
  }, [channel, ready]);

  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    const timer = setTimeout(() => {
      void publishMigrationPayload(settings);
    }, 250);
    return () => clearTimeout(timer);
  }, [backupRevision, ready, settings]);

  useEffect(() => {
    if (
      !ready ||
      Platform.OS !== 'android' ||
      !settings.selectedOperator.trim()
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void requestWidgetUpdate({
        widgetName: 'DMZRanked',
        renderWidget: renderDmzWidget
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [ready, settings.selectedOperator]);

  useEffect(() => {
    return listenForAppUpdateStatus(event => {
      setUpdateStatus(appUpdateStatusText(event));
      if (isDownloadedUpdate(event)) {
        setAppDialog({
          title: 'UPDATE READY',
          message:
            'The DMZ Ranked update finished downloading and is ready to install.',
          positiveLabel: 'INSTALL',
          negativeLabel: 'LATER',
          onPositive: installDownloadedUpdate
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    void checkForAppUpdate(false)
      .then(result => {
        if (result.available) {
          const store = result.storeVersion || 'newer build';
          setUpdateStatus(
            `Update available • ${store} • Tap CHECK to update.`
          );
          if (lastAnnouncedStoreVersion.current !== store) {
            lastAnnouncedStoreVersion.current = store;
            void showWebsiteNotification(
              '[System] Update available',
              `Google Play has DMZ Ranked ${store} ready to install.`
            );
            if (Platform.OS === 'android') {
              ToastAndroid.show(
                `Google Play update available • ${store}.`,
                ToastAndroid.LONG
              );
            }
          }
        } else {
          setUpdateStatus('Up to date • ' + installedVersionLabel());
        }
      })
      .catch(() => {
        setUpdateStatus(
          installedVersionLabel() + ' • Play check unavailable'
        );
      });
  }, [ready]);

  useEffect(() => {
    if (!settingsOpen) return;
    const poll = setInterval(() => {
      void checkForAppUpdate(false).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(poll);
  }, [settingsOpen]);

  const openPlayStore = async () => {
    const packageName =
      channel === 'beta' ? PLAY_PACKAGE_BETA : PLAY_PACKAGE_STABLE;

    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(`market://details?id=${packageName}`);
        return;
      } catch {
        // Browser fallback below.
      }
    }

    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${packageName}`
    );
  };

  const openNotificationSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent(
          'android.settings.APP_NOTIFICATION_SETTINGS',
          [
            {
              key: 'android.provider.extra.APP_PACKAGE',
              value: Application.applicationId ?? ''
            }
          ]
        );
        return;
      } catch {
        // Generic settings fallback below.
      }
    }
    await Linking.openSettings();
  };

  const refreshWidgets = async () => {
    if (Platform.OS !== 'android') return;
    await requestWidgetUpdate({
      widgetName: 'DMZRanked',
      renderWidget: renderDmzWidget
    });
  };

  const handleAction = async (action: SettingsAction) => {
    switch (action.type) {
      case 'reload':
        webRef.current?.reload();
        return;

      case 'clear-cache':
        webRef.current?.clearCache();
        setAppDialog({
          title: 'WEB CACHE CLEARED',
          message: 'Cached DMZ Ranked web resources were cleared.'
        });
        return;

      case 'clear-data': {
        webRef.current?.clearCache();
        const nativeCleared =
          Platform.OS === 'android' ? await clearWebViewData() : true;
        webRef.current?.clearWebsiteData();
        replace({
          ...settings,
          lastPageUrl: 'https://dmzranked.com/',
          selectedOperator: '',
          operatorVerified: false,
          operatorProtected: false,
          operatorSource: '',
          operatorSyncMs: 0
        });
        setBackupRevision(value => value + 1);
        setAppDialog({
          title: nativeCleared
            ? 'WEBSITE DATA CLEARED'
            : 'WEBSITE DATA CLEARED WITH WARNING',
          message: nativeCleared
            ? 'WebView cache, cookies, website storage, and the selected website operator were cleared. App operator backups were kept.'
            : 'Page storage was cleared, but Android could not confirm that every WebView cookie was removed. App operator backups were kept.'
        });
        return;
      }

      case 'save-operator':
      case 'refresh-operator':
        webRef.current?.refreshOperator();
        webRef.current?.captureOperatorBackup();
        return;

      case 'select-operator': {
        const operatorName = action.operatorName.trim();
        if (!operatorName) return;
        update('selectedOperator', operatorName);
        update('operatorVerified', false);
        update('operatorSource', 'App operator picker');
        update('operatorSyncMs', Date.now());
        const selected = await webRef.current?.selectOperator(operatorName);
        if (!selected) {
          setAppDialog({
            title: 'SELECT OPERATOR',
            message: 'Open DMZ Ranked before switching the selected operator.'
          });
        }
        return;
      }

      case 'restore-operator': {
        const restored = await webRef.current?.restoreOperatorBackup(
          action.operatorName
        );
        if (!restored) {
          setAppDialog({
            title: 'OPERATOR RESTORE',
            message: 'That local operator backup could not be restored.'
          });
        }
        return;
      }

      case 'open-app-tab':
        webRef.current?.openAppTab();
        return;

      case 'test-notification':
        await showWebsiteNotification(
          '[System] Test notification',
          'DMZ Ranked app notifications are working.'
        );
        return;

      case 'open-notification-settings':
        await openNotificationSettings();
        return;

      case 'check-updates': {
        try {
          setUpdateStatus(installedVersionLabel() + ' • Checking Google Play now…');
          const result = await checkForAppUpdate(true);
          if (!result.available) {
            setUpdateStatus('Up to date • ' + installedVersionLabel());
            setAppDialog({
              title: 'GOOGLE PLAY UPDATES',
              message: 'DMZ Ranked is up to date.'
            });
          } else {
            setUpdateStatus(
              `Update available • ${result.storeVersion || 'newer build'} • Google Play update started.`
            );
          }
        } catch {
          setUpdateStatus(
            installedVersionLabel() + ' • Play check unavailable'
          );
          setAppDialog({
            title: 'GOOGLE PLAY UPDATES',
            message:
              'Google Play could not complete the in-app update check. You can still open the store listing directly.'
          });
        }
        return;
      }

      case 'open-play-store':
        await openPlayStore();
        return;

      case 'add-widget': {
        if (Platform.OS !== 'android') return;
        try {
          const accepted = await requestPinWidget({
            widgetName: 'DMZRanked'
          });
          if (!accepted) {
            setAppDialog({
              title: 'DMZ RANKED WIDGET',
              message:
                'This launcher does not support automatic widget pinning. Add the DMZ Ranked widget manually from your home-screen widget picker.'
            });
          }
        } catch {
          setAppDialog({
            title: 'DMZ RANKED WIDGET',
            message:
              'The widget pin request could not be opened. Add the widget manually from your home-screen widget picker.'
          });
        }
        return;
      }

      case 'refresh-widgets':
        await refreshWidgets();
        return;

      case 'feedback':
        setSettingsOpen(false);
        setFeedbackOpen(true);
        return;

      case 'peer-import': {
        const imported = await importFromPeer();
        if (!imported) {
          setAppDialog({
            title: 'APP DATA TRANSFER',
            message:
              'The other DMZ Ranked app is not installed or has no compatible data available.'
          });
          return;
        }

        replace({ ...settings, ...imported.patch });
        setBackupRevision(value => value + 1);
        setAppDialog({
          title: 'APP DATA TRANSFER',
          message:
            imported.importedOperators > 0
              ? `Imported app settings and ${imported.importedOperators} operator backup${imported.importedOperators === 1 ? '' : 's'} from the other DMZ Ranked app.`
              : 'Imported compatible app settings from the other DMZ Ranked app.'
        });
        return;
      }
    }
  };

  if (!ready) {
    return <View style={styles.boot} />;
  }

  return (
    <AppSafeArea
      initialWindow
      contentScale={contentScaleFactor(settings.contentSize)}
    >
      <View style={styles.safe}>

      <AppHeader
        channel={channel}
        online={online}
        loading={loading}
        animations={settings.appAnimations}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <DmzWebScreen
        ref={webRef}
        settings={settings}
        channel={channel}
        onOpenSettings={() => setSettingsOpen(true)}
        onLoadingChange={setLoading}
        onUpdateSetting={update}
        onOperatorBackupSaved={() =>
          setBackupRevision(value => value + 1)
        }
      />

      <SettingsPanel
        visible={settingsOpen}
        settings={settings}
        channel={channel}
        backupRevision={backupRevision}
        updateStatus={updateStatus}
        onClose={() => setSettingsOpen(false)}
        onUpdate={update}
        onReset={() => void reset()}
        onAction={action => void handleAction(action)}
      />

      <FeedbackPanel
        visible={feedbackOpen}
        animations={settings.appAnimations}
        contentSize={settings.contentSize}
        onClose={() => setFeedbackOpen(false)}
      />

      <DmzDialog
        visible={Boolean(appDialog)}
        title={appDialog?.title ?? ''}
        message={appDialog?.message ?? ''}
        positiveLabel={appDialog?.positiveLabel ?? 'OK'}
        negativeLabel={appDialog?.negativeLabel}
        animations={settings.appAnimations}
        contentScale={contentScaleFactor(settings.contentSize)}
        onPositive={() => {
          const action = appDialog?.onPositive;
          setAppDialog(null);
          action?.();
        }}
        onNegative={() => setAppDialog(null)}
      />
      </View>
    </AppSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  boot: { flex: 1, backgroundColor: colors.black }
});
