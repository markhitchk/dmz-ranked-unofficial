import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { AppHeader } from './components/AppHeader';
import { SettingsPanel } from './components/SettingsPanel';
import { DmzWebScreen } from './screens/DmzWebScreen';
import { useSettings } from './hooks/useSettings';
import { initializeNotifications } from './services/notifications';
import { colors } from './theme';
import type { AppChannel } from './types';

export default function App() {
  const { settings, ready, update, reset } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [online, setOnline] = useState(true);

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

  if (!ready) {
    return <View style={styles.boot} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        channel={channel}
        online={online}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <DmzWebScreen
        settings={settings}
        channel={channel}
        onOpenSettings={() => setSettingsOpen(true)}
        onUpdateSetting={update}
      />
      <SettingsPanel
        visible={settingsOpen}
        settings={settings}
        channel={channel}
        onClose={() => setSettingsOpen(false)}
        onUpdate={update}
        onReset={() => void reset()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  boot: { flex: 1, backgroundColor: colors.background }
});
