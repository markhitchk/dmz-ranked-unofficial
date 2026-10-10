import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as Notifications from 'expo-notifications';
import * as KeepAwake from 'expo-keep-awake';
import NetInfo from '@react-native-community/netinfo';
import { AppHeader } from './components/AppHeader';
import { AppMessagesPanel } from './components/AppMessagesPanel';
import { loadAppMessages, loadReadMessageIds, saveReadMessageIds } from './services/appMessages';
import type { AppMessage } from './services/appMessagesCore';
import {
  loadNotificationHistory,
  markLocalNotificationsRead,
  subscribeNotificationCenter
} from './services/notificationCenter';
import {
  mergedNotificationItems,
  type StoredNotification
} from './services/notificationCenterCore';
import { DmzDialog } from './components/DmzDialog';
import { FeedbackPanel } from './components/FeedbackPanel';
import {
  SettingsPanel,
  type SettingsAction
} from './components/SettingsPanel';
import {
  DmzWebScreen,
  type DmzNavigationState,
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
  importLegacyJavaOperators,
  importFromPeer,
  publishMigrationPayload
} from './services/peerMigration';
import { colors, contentScaleFactor } from './theme';
import type { AppChannel, AppSettings } from './types';
import { AppSafeArea } from './components/AppSafeArea';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import {
  clearWebViewData,
  refreshDmzWidgets,
  requestPinDmzWidget,
  syncWidgetSettings
} from '../modules/dmz-migration';

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
  const [settingsTarget, setSettingsTarget] = useState<string | undefined>();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [appMessages, setAppMessages] = useState<AppMessage[]>([]);
  const [localNotifications, setLocalNotifications] = useState<StoredNotification[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<string[]>([]);
  const [messageStorageReady, setMessageStorageReady] = useState(false);
  const [refreshingMessages, setRefreshingMessages] = useState(false);
  const readMessageIdsRef = useRef<string[]>([]);
  const messageSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const messageRefreshBusy = useRef(false);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [navigation, setNavigation] = useState<DmzNavigationState>({
    url: 'https://dmzranked.com/',
    canGoBack: false,
    canGoForward: false
  });
  const [backupRevision, setBackupRevision] = useState(0);
  const [appDialog, setAppDialog] = useState<AppDialog>(null);
  const [updateStatus, setUpdateStatus] = useState(
    installedVersionLabel() + ' • Live monitoring'
  );
  const lastAnnouncedStoreVersion = useRef('');
  const foregroundAnnouncedStoreVersion = useRef('');

  const showNotice = (
    message: string,
    long = false,
    title = 'DMZ RANKED'
  ) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        message,
        long ? ToastAndroid.LONG : ToastAndroid.SHORT
      );
    } else {
      setAppDialog({ title, message });
    }
  };

  const channel =
    (Constants.expoConfig?.extra?.appChannel as AppChannel | undefined) ??
    'stable';

  const refreshLocalNotifications = useCallback(async () => {
    setLocalNotifications(await loadNotificationHistory());
  }, []);

  const refreshAppMessages = useCallback(async () => {
    if (messageRefreshBusy.current) return;
    messageRefreshBusy.current = true;
    setRefreshingMessages(true);
    try {
      await Promise.all([
        loadAppMessages(channel).then(setAppMessages),
        refreshLocalNotifications()
      ]);
    } finally {
      messageRefreshBusy.current = false;
      setRefreshingMessages(false);
    }
  }, [channel, refreshLocalNotifications]);

  useEffect(() => {
    if (!ready) return;
    void refreshLocalNotifications();
    return subscribeNotificationCenter(() => {
      void refreshLocalNotifications();
    });
  }, [ready, refreshLocalNotifications]);

  useEffect(() => {
    if (!ready) return;
    const openFromAndroidTray = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data?.openNotificationCenter !== true &&
          data?.source !== 'dmzranked-notifications' &&
          data?.source !== 'dmzranked.com') return;
      setSettingsOpen(false);
      setFeedbackOpen(false);
      setMessagesOpen(true);
      if (typeof data.notificationId === 'string') {
        void markLocalNotificationsRead([data.notificationId]).catch(() => undefined);
      }
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromAndroidTray);
    void Notifications.getLastNotificationResponseAsync().then(last => {
      if (last) openFromAndroidTray(last);
    }).catch(() => undefined);
    return () => subscription.remove();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void loadReadMessageIds().then(ids => {
      if (!alive) return;
      readMessageIdsRef.current = ids;
      setReadMessageIds(ids);
      setMessageStorageReady(true);
      void refreshAppMessages();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshAppMessages();
    }, 5 * 60 * 1000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshAppMessages();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      listener.remove();
    };
  }, [ready, refreshAppMessages]);

  const markAppMessagesRead = (ids: string[]) => {
    const remoteIds = ids.filter(id => id.startsWith('remote:')).map(id => id.slice(7));
    const localIds = ids.filter(id => id.startsWith('local:')).map(id => id.slice(6));
    if (remoteIds.length) {
      const next = [...new Set([...readMessageIdsRef.current, ...remoteIds])].slice(-200);
      readMessageIdsRef.current = next;
      setReadMessageIds(next);
      messageSaveQueue.current = messageSaveQueue.current
        .catch(() => undefined)
        .then(() => saveReadMessageIds(next));
    }
    if (localIds.length) {
      setLocalNotifications(previous =>
        previous.map(item => localIds.includes(item.id) ? { ...item, read: true } : item)
      );
      void markLocalNotificationsRead(localIds).catch(() => undefined);
    }
  };

  const openSettings = (target?: string) => {
    const nextTarget = target?.trim() || undefined;
    setSettingsTarget(nextTarget);
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setSettingsTarget(undefined);
  };

  useEffect(() => {
    const handleSettingsUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol.toLowerCase() !== 'dmzranked:') return;
        const parts = [
          parsed.hostname,
          ...parsed.pathname.split('/').filter(Boolean)
        ].filter(Boolean);
        if ((parts[0] || '').toLowerCase() !== 'settings') return;
        openSettings(parts[1] ? decodeURIComponent(parts[1]) : undefined);
      } catch {
        // Ignore unrelated or malformed deep links.
      }
    };

    void Linking.getInitialURL().then(handleSettingsUrl);
    const subscription = Linking.addEventListener('url', event =>
      handleSettingsUrl(event.url)
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(Boolean(state.isConnected));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!ready) return;

    appState.current = AppState.currentState;
    void initializeNotifications(settings.siteNotifications);
    void configureBackgroundNotifications(settings.siteNotifications);
    void setNotificationAppForeground(appState.current === 'active');

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
    if (!ready || Platform.OS !== 'android') return;
    let cancelled = false;
    void (async () => {
      // Import legacy SharedPreferences before the optional stable -> beta
      // transfer. Both channels have their own Java data to preserve.
      const legacy = await importLegacyJavaOperators().catch(() => null);
      const imported = channel === 'beta'
        ? await autoImportProductionToBeta().catch(() => null)
        : null;
      if (cancelled || (!legacy && !imported)) return;

      const patch: Partial<AppSettings> = {};
      if (legacy?.selectedOperator && !settings.selectedOperator) {
        patch.selectedOperator = legacy.selectedOperator;
      }
      if (imported) Object.assign(patch, imported.patch);
      if (Object.keys(patch).length) replace({ ...settings, ...patch });

      if ((legacy?.importedOperators ?? 0) > 0 || imported) {
        setBackupRevision(value => value + 1);
      }
      if (imported) {
        ToastAndroid.show(
          imported.importedOperators > 0
            ? 'Imported app settings and operator backups from DMZ Ranked.'
            : 'Imported app settings from DMZ Ranked.',
          ToastAndroid.LONG
        );
      } else if (legacy?.importedOperators) {
        ToastAndroid.show(
          `Recovered ${legacy.importedOperators} operator backup${legacy.importedOperators === 1 ? '' : 's'} from the Java app.`,
          ToastAndroid.LONG
        );
      }
    })();
    return () => { cancelled = true; };
  }, [channel, ready]);

  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    const timer = setTimeout(() => {
      void publishMigrationPayload(settings);
    }, 250);
    return () => clearTimeout(timer);
  }, [backupRevision, ready, settings]);

  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;

    const timer = setTimeout(() => {
      void syncWidgetSettings(settings.selectedOperator).then(() =>
        refreshDmzWidgets()
      );
    }, 450);

    return () => clearTimeout(timer);
  }, [ready, settings.selectedOperator]);

  useEffect(() => {
    return listenForAppUpdateStatus(event => {
      if (settingsOpen) {
        setUpdateStatus(appUpdateStatusText(event));
      }
      if (isDownloadedUpdate(event)) {
        setAppDialog({
          title: 'UPDATE READY',
          message:
            'The DMZ Ranked update finished downloading from Google Play and is ready to install.',
          positiveLabel: 'INSTALL & RESTART',
          negativeLabel: 'LATER',
          onPositive: installDownloadedUpdate
        });
      }
    });
  }, [settingsOpen]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const checkForegroundUpdate = () => {
      void checkForAppUpdate(false)
        .then(result => {
          if (cancelled || !result.available) return;
          const store = result.storeVersion || 'newer build';
          if (foregroundAnnouncedStoreVersion.current === store) return;
          foregroundAnnouncedStoreVersion.current = store;

          setAppDialog({
            title: 'UPDATE AVAILABLE',
            message:
              `Google Play has DMZ Ranked ${store} ready for this device. You can download it now without leaving the app.`,
            positiveLabel: 'UPDATE NOW',
            negativeLabel: 'LATER',
            onPositive: () => {
              void checkForAppUpdate(true).catch(() => {
                void openPlayStore();
              });
            }
          });
        })
        .catch(() => undefined);
    };

    checkForegroundUpdate();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkForegroundUpdate();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !settingsOpen) return;

    let cancelled = false;
    const check = () => {
      void checkForAppUpdate(false)
        .then(result => {
          if (cancelled) return;
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
          if (!cancelled) {
            setUpdateStatus(
              installedVersionLabel() + ' • Play check unavailable'
            );
          }
        });
    };

    check();
    const poll = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [ready, settingsOpen]);

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
    await syncWidgetSettings(settings.selectedOperator);
    await refreshDmzWidgets();
  };

  const handleAction = async (action: SettingsAction) => {
    switch (action.type) {
      case 'reload':
        webRef.current?.reload();
        return;

      case 'clear-cache':
        webRef.current?.clearCache();
        showNotice(
          'Web cache cleared. Cookies and website storage were kept.'
        );
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
        if (nativeCleared) {
          showNotice(
            'Website data cleared. App operator backups were kept.',
            true
          );
        } else {
          showNotice(
            'Could not confirm that every Android WebView cookie was cleared. App operator backups were kept.',
            true,
            'WEBSITE DATA CLEARED WITH WARNING'
          );
        }
        return;
      }

      case 'save-operator':
      case 'refresh-operator': {
        webRef.current?.refreshOperator();
        const result = await webRef.current?.saveOperatorBackupNow();
        if (result?.ok) {
          showNotice(`Saved ${result.operatorName} operator backup locally.`);
        } else {
          const reason = result && !result.ok ? result.reason : 'not-dmz';
          showNotice(
            reason === 'no-operator'
              ? 'No operator is selected on DMZ Ranked. Choose an operator on the website first.'
              : reason === 'no-data'
                ? 'No safe website data to back up yet. Use the selected operator on DMZ Ranked, then sync again.'
                : reason === 'not-dmz'
                  ? 'Open DMZ Ranked before syncing an operator.'
                  : reason === 'timeout'
                    ? 'Operator sync timed out. Allow the website to load, then try again.'
                    : 'Could not save the operator backup. Please retry.',
            true,
            'OPERATOR SYNC'
          );
        }
        return;
      }

      case 'select-operator': {
        const operatorName = action.operatorName.trim();
        if (!operatorName) return;
        update('selectedOperator', operatorName);
        update('operatorVerified', false);
        update('operatorSource', 'App operator picker');
        update('operatorSyncMs', Date.now());
        const selected = await webRef.current?.selectOperator(operatorName);
        if (!selected) {
          showNotice(
            'Open DMZ Ranked before switching the selected operator.',
            true,
            'SELECT OPERATOR'
          );
        } else {
          showNotice(`Switching to ${operatorName}…`);
        }
        return;
      }

      case 'restore-operator': {
        const restored = await webRef.current?.restoreOperatorBackup(
          action.operatorName
        );
        if (!restored) {
          showNotice(
            'Open DMZ Ranked before restoring an operator.',
            true,
            'OPERATOR RESTORE'
          );
          return;
        }

        if (!restored.ok) {
          const operatorName =
            restored.operatorName || action.operatorName || 'this operator';
          const message =
            restored.reason === 'not-dmz'
              ? 'Open DMZ Ranked before restoring an operator.'
              : restored.reason === 'missing-backup'
                ? 'No saved operator backup is available.'
                : restored.reason === 'no-data'
                  ? 'The saved operator backup has no restorable website data.'
                  : restored.reason === 'switch-operator'
                    ? `Switch DMZ Ranked to ${operatorName} before restoring this operator.`
                    : restored.reason === 'pin-required'
                      ? `${operatorName} is PIN protected. Select that operator on DMZ Ranked and enter its PIN first.`
                      : 'DMZ Ranked could not restore the saved operator data.';
          showNotice(
            message,
            true,
            'OPERATOR RESTORE'
          );
          return;
        }

        if (Platform.OS === 'android') {
          ToastAndroid.show(
            `Restored ${restored.operatorName}. Reloading DMZ Ranked…`,
            ToastAndroid.SHORT
          );
        }
        return;
      }

      case 'open-app-tab':
        webRef.current?.openAppTab();
        return;

      case 'test-notification':
        await showWebsiteNotification(
          '[System] Test notification',
          'Test alert from DMZ Ranked. Every system alert now appears in the Notification Center.'
        );
        showNotice('Test saved to your bell. Android pop-up depends on notification settings.');
        return;

      case 'open-notification-center':
        closeSettings();
        setMessagesOpen(true);
        void refreshAppMessages();
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
            showNotice('DMZ Ranked is up to date.');
          } else {
            setUpdateStatus(
              `Update available • ${result.storeVersion || 'newer build'} • Google Play update started.`
            );
          }
        } catch {
          setUpdateStatus(
            installedVersionLabel() + ' • Play check unavailable'
          );
          showNotice(
            'Update status is unavailable. Opening Google Play.',
            true,
            'GOOGLE PLAY UPDATES'
          );
          void openPlayStore();
        }
        return;
      }

      case 'open-play-store':
        await openPlayStore();
        return;

      case 'add-widget': {
        if (Platform.OS !== 'android') return;
        try {
          await syncWidgetSettings(settings.selectedOperator);
          const accepted = await requestPinDmzWidget();
          if (accepted) {
            showNotice('Choose where to place the DMZ Ranked widget.');
          } else {
            showNotice(
              'Open your Android launcher’s Widgets menu and add DMZ Ranked.',
              true,
              'DMZ RANKED WIDGET'
            );
          }
        } catch {
          showNotice(
            'Open your Android launcher’s Widgets menu and add DMZ Ranked.',
            true,
            'DMZ RANKED WIDGET'
          );
        }
        return;
      }

      case 'refresh-widgets':
        showNotice('Refreshing DMZ Ranked widgets…');
        await refreshWidgets();
        return;

      case 'feedback':
        closeSettings();
        setFeedbackOpen(true);
        return;

      case 'peer-import': {
        const peerLabel =
          channel === 'beta' ? 'DMZ Ranked' : 'DMZ Ranked [Beta]';
        const imported = await importFromPeer();
        if (!imported) {
          showNotice(
            `${peerLabel} is not available to import from.`,
            true,
            'APP DATA TRANSFER'
          );
          return;
        }

        replace({ ...settings, ...imported.patch });
        setBackupRevision(value => value + 1);
        const importedSettings = Object.keys(imported.patch).length;
        showNotice(
          `Imported ${importedSettings} app setting${importedSettings === 1 ? '' : 's'} and ${imported.importedOperators} operator backup${imported.importedOperators === 1 ? '' : 's'} from ${peerLabel}.`,
          true,
          'APP DATA TRANSFER'
        );
        return;
      }
    }
  };

  if (!ready) {
    return <View style={styles.boot} />;
  }

  const allNotifications = mergedNotificationItems(appMessages, readMessageIds, localNotifications);
  const unreadMessages = allNotifications.filter(message => !message.isRead);
  const popupMessage =
    messageStorageReady && !messagesOpen && !settingsOpen && !feedbackOpen && !loading && !appDialog
      ? appMessages.find(message =>
          message.display === 'popup' && !readMessageIds.includes(message.id)
        )
      : undefined;

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
        currentUrl={navigation.url}
        canGoBack={navigation.canGoBack}
        canGoForward={navigation.canGoForward}
        onGoBack={() => webRef.current?.goBack()}
        onGoForward={() => webRef.current?.goForward()}
        onReload={() => webRef.current?.reload()}
        onNavigate={url => webRef.current?.navigate(url)}
        onOpenSettings={() => openSettings()}
        unreadMessages={unreadMessages.length}
        onOpenMessages={() => setMessagesOpen(true)}
      />

      <DmzWebScreen
        ref={webRef}
        suspendBackgroundWork={settingsOpen || feedbackOpen || messagesOpen || Boolean(popupMessage)}
        settings={settings}
        channel={channel}
        onOpenSettings={openSettings}
        onLoadingChange={setLoading}
        onNavigationChange={setNavigation}
        onUpdateSetting={update}
        onOperatorBackupSaved={() =>
          setBackupRevision(value => value + 1)
        }
      />

      <SettingsPanel
        visible={settingsOpen}
        target={settingsTarget}
        settings={settings}
        channel={channel}
        backupRevision={backupRevision}
        updateStatus={updateStatus}
        onClose={closeSettings}
        onUpdate={update}
        onReset={() => void reset()}
        onAction={action => void handleAction(action)}
      />

      <AppMessagesPanel
        visible={messagesOpen}
        messages={allNotifications}
        refreshing={refreshingMessages}
        onClose={() => setMessagesOpen(false)}
        onRefresh={() => { void refreshAppMessages(); }}
        onRead={id => markAppMessagesRead([id])}
        onReadAll={() => markAppMessagesRead(allNotifications.filter(item => !item.isRead).map(item => item.id))}
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
      <DmzDialog
        visible={Boolean(popupMessage)}
        eyebrow="HARLEY'S STUDIOS • MESSAGE"
        title={popupMessage?.title ?? ''}
        message={popupMessage && popupMessage.body.length > 420
          ? popupMessage.body.slice(0, 420) + '…\n\nOpen App Messages to read the full announcement.'
          : popupMessage?.body ?? ''}
        positiveLabel={popupMessage?.link ? (popupMessage.linkLabel ?? 'OPEN LINK') : 'GOT IT'}
        negativeLabel="DISMISS"
        animations={settings.appAnimations}
        contentScale={contentScaleFactor(settings.contentSize)}
        onPositive={() => {
          if (!popupMessage) return;
          markAppMessagesRead(['remote:' + popupMessage.id]);
          if (popupMessage.link) {
            void Linking.openURL(popupMessage.link).catch(() => undefined);
          }
        }}
        onNegative={() => {
          if (popupMessage) markAppMessagesRead(['remote:' + popupMessage.id]);
        }}
      />
      </View>
    </AppSafeArea>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  boot: { flex: 1, backgroundColor: colors.black }
});
