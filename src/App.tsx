import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View
} from 'react-native';
import Constants from 'expo-constants';
import * as KeepAwake from 'expo-keep-awake';
import NetInfo from '@react-native-community/netinfo';
import { AppHeader } from './components/AppHeader';
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
import { colors } from './theme';
import type { AppChannel, AppSettings } from './types';

const PLAY_PACKAGE_STABLE = 'com.harleytg.dmzranked';
const PLAY_PACKAGE_BETA = 'com.harleytg.dmzranked.beta';

export default function App() {
  const { settings, ready, update, replace, reset } = useSettings();
  const webRef = useRef<DmzWebHandle>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

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
    if (ready) {
      void initializeNotifications(settings.siteNotifications);
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

  const openPlayStore = async () => {
    const packageName =
      channel === 'beta' ? PLAY_PACKAGE_BETA : PLAY_PACKAGE_STABLE;
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(`market://details?id=${packageName}`);
        return;
      } catch {
        // Fall through to browser.
      }
    }
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${packageName}`
    );
  };

  const handleAction = (action: SettingsAction) => {
    switch (action) {
      case 'reload':
        webRef.current?.reload();
        break;
      case 'clear-cache':
        webRef.current?.clearCache();
        Alert.alert('DMZ Ranked', 'Web cache cleared.');
        break;
      case 'clear-data':
        webRef.current?.clearCache();
        webRef.current?.clearWebsiteData();
        break;
      case 'save-operator':
      case 'refresh-operator':
        webRef.current?.refreshOperator();
        Alert.alert('Operator', 'Operator status refreshed from dmzranked.com.');
        break;
      case 'open-app-tab':
        webRef.current?.openAppTab();
        break;
      case 'test-notification':
        void showWebsiteNotification(
          'DMZ Ranked',
          'Test notification from the DMZ Ranked app.'
        );
        break;
      case 'open-notification-settings':
        void Linking.openSettings();
        break;
      case 'check-updates':
        void openPlayStore();
        break;
      case 'add-widget':
        Alert.alert(
          'DMZ Ranked widget',
          'The React Native migration is matching the main app UI first. The Android home-screen widget provider is the remaining native-only item.'
        );
        break;
      case 'refresh-widgets':
        Alert.alert(
          'DMZ Ranked widget',
          'No React Native home-screen widget is registered in this build yet.'
        );
        break;
      case 'peer-import':
        Alert.alert(
          'Import from DMZ Ranked',
          'Cross-package migration from the Java app requires the original Android ContentProvider and is not available in the React Native build yet.'
        );
        break;
    }
  };

  const replaceSettings = (next: AppSettings) => {
    replace(next);
  };

  if (!ready) {
    return <View style={styles.boot} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.black}
        translucent={false}
      />

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
      />

      <SettingsPanel
        visible={settingsOpen}
        settings={settings}
        channel={channel}
        onClose={() => setSettingsOpen(false)}
        onUpdate={update}
        onReplaceSettings={replaceSettings}
        onReset={() => void reset()}
        onAction={handleAction}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  boot: { flex: 1, backgroundColor: colors.black }
});
