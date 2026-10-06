import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WebView } from 'react-native-webview';
import type { AppSettings } from '../types';
import { colors } from '../theme';
import { LoadingOverlay } from '../components/LoadingOverlay';
import {
  buildRemoteUiInjection,
  loadRemoteAppUi
} from '../services/remoteAppUi';
import {
  createBridgeBootstrap,
  parseBridgeMessage
} from '../services/webBridge';
import { showWebsiteNotification } from '../services/notifications';

const HOME_URL = 'https://dmzranked.com/';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 DMZRankedApp/1.0.61';

type Props = {
  settings: AppSettings;
  channel: 'stable' | 'beta';
  onOpenSettings: () => void;
  onUpdateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
};

function isInternal(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'dmzranked.com' || host.endsWith('.dmzranked.com');
  } catch {
    return true;
  }
}

export function DmzWebScreen({
  settings,
  channel,
  onOpenSettings,
  onUpdateSetting
}: Props) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const bridge = useMemo(() => createBridgeBootstrap(channel), [channel]);

  const applyRemoteUi = useCallback(async () => {
    if (!settings.appUiOverrides || !webRef.current) return;

    try {
      const { css, js } = await loadRemoteAppUi();
      webRef.current.injectJavaScript(buildRemoteUiInjection(css, js));
    } catch {
      // dmzranked.com stays usable; the next page load retries the override.
    }
  }, [settings.appUiOverrides]);

  const handleLoadEnd = useCallback(async () => {
    setLoading(false);
    setFailed(false);
    await applyRemoteUi();
  }, [applyRemoteUi]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const message = parseBridgeMessage(event.nativeEvent.data);
      if (!message) return;

      if (message.type === 'open-settings') {
        onOpenSettings();
        return;
      }

      if (message.type === 'notification' && settings.siteNotifications) {
        void showWebsiteNotification(
          message.title?.trim() || 'DMZ Ranked',
          message.body?.trim() || 'New activity is available.'
        );
        return;
      }

      if (message.type === 'operator') {
        if (typeof message.name === 'string') {
          onUpdateSetting('selectedOperator', message.name);
        }
        onUpdateSetting('operatorVerified', Boolean(message.verified));
      }
    },
    [onOpenSettings, onUpdateSetting, settings.siteNotifications]
  );

  const handleNavigation = useCallback(
    (nav: { url: string }) => {
      if (settings.rememberLastPage && isInternal(nav.url)) {
        onUpdateSetting('lastPageUrl', nav.url);
      }
    },
    [onUpdateSetting, settings.rememberLastPage]
  );

  const handleShouldStart = useCallback((request: { url: string }) => {
    if (isInternal(request.url) || request.url === 'about:blank') {
      return true;
    }

    void Linking.openURL(request.url);
    return false;
  }, []);

  const retry = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    setFailed(false);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{
          uri: settings.rememberLastPage
            ? settings.lastPageUrl || HOME_URL
            : HOME_URL
        }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        pullToRefreshEnabled={settings.pullToRefresh}
        userAgent={settings.desktopSite ? DESKTOP_UA : undefined}
        injectedJavaScriptBeforeContentLoaded={bridge}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigation}
        onShouldStartLoadWithRequest={handleShouldStart}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />

      {loading ? <LoadingOverlay verbose={settings.verboseLoading} /> : null}

      {failed ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>DMZ Ranked couldn&apos;t load</Text>
          <Text style={styles.errorText}>
            Check your connection and try again.
          </Text>
          <Pressable style={styles.retry} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: colors.background },
  error: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background
  },
  errorTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  errorText: { color: colors.muted, marginTop: 7, textAlign: 'center' },
  retry: {
    marginTop: 18,
    backgroundColor: colors.gold,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10
  },
  retryText: { color: '#111', fontWeight: '900' }
});
