import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
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
  syncNotificationsNow
} from './services/backgroundNotificationSync';
import {
  checkForAppUpdate,
  installDownloadedUpdate,
  isDownloadedUpdate,
  listenForAppUpdateStatus
} from './services/appUpdates';
import {
  importFromPeer,
  publishMigrationPayload
} from './services/peerMigration';
import { renderDmzWidget } from './widgets/widgetTaskHandler';
import { colors } from './theme';
import type { AppChannel } from './types';
import { AppSafeArea } from './components/AppSafeArea';

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
    <AppSafeArea initialWindow>
      <AppContent />
    </AppSafeArea>
  );
}

function AppContent() {
  const { settings, ready, update, replace, reset } = useSettings();
  const webRef = useRef<DmzWebHandle>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [backupRevision, setBackupRevision] = useState(0);
  const [appDialog, setAppDialog] = useState<AppDialog>(null);

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

    if (settings.siteNotifications) {
      void syncNotificationsNow();
    }
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
          setAppDialog({
            title: 'UPDATE AVAILABLE',
            message:
              'Google Play has a newer DMZ Ranked build available.',
            positiveLabel: 'UPDATE',
            negativeLabel: 'LATER',
            onPositive: () => {
              void checkForAppUpdate(true);
            }
          });
        }
      })
      .catch(() => undefined);
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

      case 'clear-data':
        webRef.current?.clearCache();
        webRef.current?.clearWebsiteData();
        return;

      case 'save-operator':
      case 'refresh-operator':
        webRef.current?.refreshOperator();
        webRef.current?.captureOperatorBackup();
        return;

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
          const result = await checkForAppUpdate(true);
          if (!result.available) {
            setAppDialog({
              title: 'GOOGLE PLAY UPDATES',
              message: 'No newer DMZ Ranked build is available for this app right now.'
            });
          }
        } catch {
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
        onClose={() => setSettingsOpen(false)}
        onUpdate={update}
        onReset={() => void reset()}
        onAction={action => void handleAction(action)}
      />

      <FeedbackPanel
        visible={feedbackOpen}
        animations={settings.appAnimations}
        onClose={() => setFeedbackOpen(false)}
      />

      <DmzDialog
        visible={Boolean(appDialog)}
        title={appDialog?.title ?? ''}
        message={appDialog?.message ?? ''}
        positiveLabel={appDialog?.positiveLabel ?? 'OK'}
        negativeLabel={appDialog?.negativeLabel}
        animations={settings.appAnimations}
        onPositive={() => {
          const action = appDialog?.onPositive;
          setAppDialog(null);
          action?.();
        }}
        onNegative={() => setAppDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  boot: { flex: 1, backgroundColor: colors.black }
});
