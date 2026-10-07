import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WebView } from 'react-native-webview';
import type { AppSettings } from '../types';
import { colors, condensedFont } from '../theme';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { loadRemoteAppUi } from '../services/remoteAppUi';
import { buildRemoteUiInjection } from '../services/appUiInjection';
import { AppUiLoadGate } from '../services/appUiLoadGate';
import {
  createBridgeBootstrap,
  parseBridgeMessage
} from '../services/webBridge';
import { showWebsiteNotification } from '../services/notifications';
import {
  processForegroundOperatorState,
  recordForegroundNotification
} from '../services/backgroundNotificationSync';
import {
  buildOperatorRestoreScript,
  getOperatorBackup,
  saveOperatorBackup
} from '../services/operatorBackup';

const HOME_URL = 'https://dmzranked.com/';
const PAYPAL_SHARE_URL = 'https://share.google/9nj1GcaYNu3qJTTeu';
const KOFI_URL = 'https://ko-fi.com/harleytg_#checkoutModal';
const APP_SUPPORT_DISCORD_URL = 'https://discord.gg/kdHneTZkyd';
const MAIN_DISCORD_URL = 'https://discord.gg/jTaTHqw45F';
const BETA_GROUP_URL = 'https://groups.google.com/g/dmz-ranked';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 DMZRankedApp/1.0.63';

export type DmzWebHandle = {
  reload: () => void;
  clearCache: () => void;
  clearWebsiteData: () => void;
  refreshOperator: () => void;
  captureOperatorBackup: () => void;
  restoreOperatorBackup: (operatorName: string) => Promise<boolean>;
  openAppTab: () => void;
};

type Props = {
  settings: AppSettings;
  channel: 'stable' | 'beta';
  onOpenSettings: () => void;
  onLoadingChange: (loading: boolean) => void;
  onUpdateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  onOperatorBackupSaved?: (operatorName: string) => void;
};

function isInternal(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'dmzranked.com' || host.endsWith('.dmzranked.com');
  } catch {
    return true;
  }
}

function isAllowedExternal(url: string): boolean {
  if (
    url.startsWith(PAYPAL_SHARE_URL) ||
    url.startsWith(KOFI_URL) ||
    url.startsWith(APP_SUPPORT_DISCORD_URL) ||
    url.startsWith(MAIN_DISCORD_URL) ||
    url.startsWith(BETA_GROUP_URL)
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    if (
      host === 'discord.gg' ||
      host === 'www.discord.gg' ||
      host === 'discord.com'
    ) {
      return (
        path.includes('kdHneTZkyd') || path.includes('jTaTHqw45F')
      );
    }
    if (
      host === 'groups.google.com' ||
      host === 'www.groups.google.com'
    ) {
      return path === '/g/dmz-ranked' || path.startsWith('/g/dmz-ranked/');
    }
    if (host === 'ko-fi.com' || host === 'www.ko-fi.com') return true;
    if (
      host === 'paypal.me' ||
      host === 'www.paypal.me' ||
      host === 'paypal.com' ||
      host === 'www.paypal.com'
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function contentZoom(size: AppSettings['contentSize']): number {
  if (size === 'compact') return 96;
  if (size === 'large') return 104;
  return 100;
}

export const DmzWebScreen = forwardRef<DmzWebHandle, Props>(
  function DmzWebScreen(
    {
      settings,
      channel,
      onOpenSettings,
      onLoadingChange,
      onUpdateSetting,
      onOperatorBackupSaved
    },
    ref
  ) {
    const webRef = useRef<WebView>(null);
    const initialUrl = useRef(
      settings.rememberLastPage
        ? settings.lastPageUrl || HOME_URL
        : HOME_URL
    );
    const [loading, setLoading] = useState(true);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Starting DMZ Ranked…');
    const [failed, setFailed] = useState(false);
    const [failureKind, setFailureKind] = useState<'network' | 'interface'>('network');
    const overlayOpacity = useRef(new Animated.Value(1)).current;
    const gate = useRef(new AppUiLoadGate()).current;
    const page = useRef({ id: 0, url: initialUrl.current, loaded: false, requiresOverrides: settings.appUiOverrides });
    const payload = useRef<Promise<{ css: string; js: string }> | null>(null);
    const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canGoBack = useRef(false);
    const pullStartY = useRef<number | null>(null);
    const pullTriggered = useRef(false);
    const webScrollY = useRef(0);
    const previousDesktopMode = useRef(settings.desktopSite);

    const clearLoadTimers = useCallback(() => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (readyTimer.current) clearTimeout(readyTimer.current);
      if (backupTimer.current) clearTimeout(backupTimer.current);
      finishTimer.current = readyTimer.current = backupTimer.current = null;
    }, []);

    useEffect(() => () => {
      gate.cancel();
      clearLoadTimers();
      overlayOpacity.stopAnimation();
    }, [clearLoadTimers, gate, overlayOpacity]);

    useEffect(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (!webRef.current) return false;
          webRef.current.injectJavaScript(
            `(function(){var result="missing";try{if(window.__dmzRnSectionBack){result=window.__dmzRnSectionBack();}}catch(e){result="error";}window.ReactNativeWebView.postMessage(JSON.stringify({type:"back-result",result:result}));return true;})();true;`
          );
          return true;
        }
      );
      return () => subscription.remove();
    }, []);

    useEffect(() => {
      if (previousDesktopMode.current === settings.desktopSite) return;
      previousDesktopMode.current = settings.desktopSite;
      showOverlay('Applying display mode…', 0);
      webRef.current?.reload();
    }, [settings.desktopSite, showOverlay]);

    const bridge = useMemo(() => createBridgeBootstrap(channel), [channel]);

    const setLoadingState = useCallback(
      (value: boolean) => {
        setLoading(value);
        onLoadingChange(value);
      },
      [onLoadingChange]
    );

    const refreshOperator = useCallback(() => {
      webRef.current?.injectJavaScript(
        'if(window.__dmzRnReadOperator){window.__dmzRnReadOperator();}true;'
      );
    }, []);

    const captureOperatorBackup = useCallback(() => {
      webRef.current?.injectJavaScript(
        'if(window.__dmzRnCaptureBackup){window.__dmzRnCaptureBackup();}true;'
      );
    }, []);

    const restoreOperatorBackup = useCallback(
      async (operatorName: string): Promise<boolean> => {
        const record = await getOperatorBackup(operatorName);
        if (!record) return false;
        const script = buildOperatorRestoreScript(record);
        if (!script) return false;
        webRef.current?.injectJavaScript(
          script +
            ';if(window.__dmzRnReadOperator){window.__dmzRnReadOperator();}location.reload();true;'
        );
        onUpdateSetting('selectedOperator', record.operator);
        onUpdateSetting('operatorProtected', record.protected);
        return true;
      },
      [onUpdateSetting]
    );

    useImperativeHandle(
      ref,
      () => ({
        reload: () => webRef.current?.reload(),
        clearCache: () => {
          const view = webRef.current as (WebView & {
            clearCache?: (includeDiskFiles?: boolean) => void;
          }) | null;
          view?.clearCache?.(true);
        },
        clearWebsiteData: () => {
          webRef.current?.injectJavaScript(
            '(function(){try{localStorage.clear();sessionStorage.clear();document.cookie.split(";").forEach(function(c){document.cookie=c.replace(/^ +/,"").replace(/=.*/,"=;expires="+new Date(0).toUTCString()+";path=/");});location.reload();}catch(e){location.reload();}})();true;'
          );
        },
        refreshOperator,
        captureOperatorBackup,
        restoreOperatorBackup,
        openAppTab: () => {
          webRef.current?.injectJavaScript(
            `(function(){var wanted=['UNOFFICIAL APP','DMZ RANKED APP','DMZ RANKED APP [UNOFFICIAL]'];var list=document.querySelectorAll('button,a,[role=button],[data-tab]');for(var i=0;i<list.length;i++){var t=String(list[i].innerText||list[i].textContent||'').replace(/\\s+/g,' ').trim().toUpperCase();if(wanted.indexOf(t)>=0){list[i].click();break;}}return true;})();true;`
          );
        }
      }),
      [captureOperatorBackup, refreshOperator, restoreOperatorBackup]
    );

    const showOverlay = useCallback(
      (nextStatus: string, nextProgress: number) => {
        overlayOpacity.stopAnimation();
        overlayOpacity.setValue(1);
        setOverlayVisible(true);
        setStatus(nextStatus);
        setProgress(nextProgress);
        setLoadingState(true);
      },
      [overlayOpacity, setLoadingState]
    );

    const hideOverlay = useCallback((id: number) => {
      if (!gate.claimReady(id)) return;
      if (readyTimer.current) clearTimeout(readyTimer.current);
      setProgress(100);
      setStatus('Ready.');
      const finish = () => {
        if (!gate.isCurrent(id)) return;
        setOverlayVisible(false);
        setLoadingState(false);
        refreshOperator();
        if (settings.operatorAutoSave) {
          backupTimer.current = setTimeout(() => {
            if (gate.isCurrent(id)) captureOperatorBackup();
          }, 500);
        }
      };

      finishTimer.current = setTimeout(() => {
        if (!gate.isCurrent(id)) return;
        if (!settings.appAnimations) {
          finish();
          return;
        }
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true
        }).start(({ finished }) => { if (finished) finish(); });
      }, 120);
    }, [captureOperatorBackup, gate, overlayOpacity, refreshOperator, setLoadingState, settings.appAnimations, settings.operatorAutoSave]);

    const failLoad = useCallback((id: number, kind: 'network' | 'interface') => {
      if (!gate.isCurrent(id)) return;
      gate.fail(id);
      clearLoadTimers();
      overlayOpacity.stopAnimation();
      setLoadingState(false);
      setOverlayVisible(false);
      setFailureKind(kind);
      setFailed(true);
    }, [clearLoadTimers, gate, overlayOpacity, setLoadingState]);

    const handleLoadStart = useCallback((url: string) => {
      clearLoadTimers();
      const id = gate.begin(settings.appUiOverrides);
      page.current = { id, url, loaded: false, requiresOverrides: settings.appUiOverrides };
      payload.current = settings.appUiOverrides ? loadRemoteAppUi() : null;
      // Attach a rejection handler immediately while the document is loading.
      void payload.current?.catch(() => undefined);
      setFailed(false);
      showOverlay('Connecting to dmzranked.com…', 5);
    }, [clearLoadTimers, gate, settings.appUiOverrides, showOverlay]);

    const applyDesktopViewport = useCallback(() => {
      if (!settings.desktopSite) return;
      webRef.current?.injectJavaScript(
        `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.setAttribute('content','width=1280, initial-scale=0.75, minimum-scale=0.25, maximum-scale=3, user-scalable=yes');document.documentElement.style.minWidth='1180px';}catch(e){}})();true;`
      );
    }, [settings.desktopSite]);

    const handleLoad = useCallback(async (url: string) => {
      const current = page.current;
      const id = current.id;
      if (url !== current.url || !gate.isCurrent(id) || current.loaded) return;
      current.loaded = true;
      gate.loaded(id);
      applyDesktopViewport();
      if (!current.requiresOverrides) {
        hideOverlay(id);
        return;
      }
      setProgress(95);
      setStatus('Installing the DMZ Ranked app interface…');
      readyTimer.current = setTimeout(() => failLoad(id, 'interface'), 20000);
      try {
        const { css, js } = await (payload.current ?? loadRemoteAppUi());
        if (!gate.isCurrent(id)) return;
        // BeforeContentLoaded can be skipped on Android. Ensure the original
        // app info/bridge exists immediately before the app scripts execute.
        webRef.current?.injectJavaScript(bridge + '\n' + buildRemoteUiInjection(css, js, id));
        setProgress(98);
        setStatus('Checking app styles and the App tab…');
      } catch {
        failLoad(id, 'interface');
      }
    }, [applyDesktopViewport, bridge, failLoad, gate, hideOverlay]);

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        const message = parseBridgeMessage(event.nativeEvent.data);
        if (!message) return;

        if (message.type === 'app-ui-ready' || message.type === 'app-ui-error') {
          if (!gate.isCurrent(message.pageId)) return;
          if (message.type === 'app-ui-error') {
            failLoad(message.pageId, 'interface');
          } else {
            gate.verified(message.pageId);
            hideOverlay(message.pageId);
          }
          return;
        }

        if (message.type === 'open-settings') {
          onOpenSettings();
          return;
        }

        if (message.type === 'notification' && settings.siteNotifications) {
          const title = message.title?.trim() || 'DMZ Ranked';
          const body = message.body?.trim() || 'New activity is available.';
          void showWebsiteNotification(title, body).then(() =>
            recordForegroundNotification(title, body)
          );
          return;
        }

        if (message.type === 'operator-alert-state' && message.snapshot) {
          const raids: Record<string, {
            reports: number;
            pending: boolean;
            verified: boolean;
            pendingReason: string;
          }> = {};
          for (const [key, value] of Object.entries(message.snapshot.raids ?? {})) {
            raids[key] = {
              reports: Math.max(0, Number(value.reports) || 0),
              pending: Boolean(value.pending),
              verified: Boolean(value.verified),
              pendingReason: String(value.pendingReason ?? '')
            };
          }
          void processForegroundOperatorState({
            playerId: String(message.snapshot.playerId ?? ''),
            name: String(message.snapshot.name ?? ''),
            reports: Math.max(0, Number(message.snapshot.reports) || 0),
            raids
          });
          return;
        }

        if (message.type === 'back-result') {
          if (message.result === 'handled') return;
          if (canGoBack.current) {
            webRef.current?.goBack();
          } else if (Platform.OS === 'android') {
            BackHandler.exitApp();
          }
          return;
        }

        if (message.type === 'operator') {
          const nextName =
            typeof message.name === 'string' ? message.name.trim() : '';
          if (nextName) {
            onUpdateSetting('selectedOperator', nextName);
          }
          onUpdateSetting('operatorVerified', Boolean(message.verified));
          onUpdateSetting('operatorProtected', Boolean(message.protected));
          if (typeof message.source === 'string') {
            onUpdateSetting('operatorSource', message.source);
          }
          if (nextName && settings.operatorAutoSave) {
            setTimeout(captureOperatorBackup, 180);
          }
          return;
        }

        if (
          message.type === 'operator-backup' &&
          typeof message.name === 'string' &&
          message.name.trim() &&
          message.snapshot?.storage
        ) {
          void saveOperatorBackup(message.name, {
            origin: message.snapshot.origin,
            storage: message.snapshot.storage,
            protected: Boolean(message.snapshot.protected),
            verified: Boolean(message.snapshot.verified)
          }).then(saved => {
            if (saved) {
              onOperatorBackupSaved?.(message.name!.trim());
            }
          });
        }
      },
      [
        captureOperatorBackup,
        failLoad,
        gate,
        hideOverlay,
        onOpenSettings,
        onOperatorBackupSaved,
        onUpdateSetting,
        settings.operatorAutoSave,
        settings.siteNotifications
      ]
    );

    const handleNavigation = useCallback(
      (nav: { url: string; canGoBack?: boolean }) => {
        canGoBack.current = Boolean(nav.canGoBack);
        if (settings.rememberLastPage && isInternal(nav.url)) {
          onUpdateSetting('lastPageUrl', nav.url);
        }
      },
      [onUpdateSetting, settings.rememberLastPage]
    );

    const handleShouldStart = useCallback(
      (request: { url: string }) => {
        const url = request.url;
        if (isInternal(url) || url === 'about:blank') return true;

        if (url.toLowerCase().startsWith('dmzranked-support:')) {
          try {
            const target = new URL(url).searchParams.get('url');
            if (target && /^https?:/i.test(target)) {
              void Linking.openURL(target);
            } else {
              Alert.alert(
                'DMZ Ranked',
                'The website donation link is invalid.'
              );
            }
          } catch {
            Alert.alert(
              'DMZ Ranked',
              'Could not open the website donation link.'
            );
          }
          return false;
        }

        if (/^https?:/i.test(url) && isAllowedExternal(url)) {
          void Linking.openURL(url);
          return false;
        }

        Alert.alert(
          'External link blocked',
          "Allowed links are the approved PayPal, Harley's Studios Ko-fi, DMZ Ranked Discord invites, and app beta group."
        );
        return false;
      },
      []
    );

    const retry = useCallback(async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;
      gate.cancel();
      clearLoadTimers();
      setFailed(false);
      showOverlay('Connecting to dmzranked.com…', 5);
      webRef.current?.reload();
    }, [clearLoadTimers, gate, showOverlay]);

    const progressStatus = useCallback((value: number) => {
      if (value < 20) return `Connecting… ${value}%`;
      if (value < 65) return `Loading DMZ Ranked… ${value}%`;
      if (value < 95) return `Loading page assets… ${value}%`;
      if (value < 100) return `Finishing up… ${value}%`;
      return 'Page loaded • waiting for live sync…';
    }, []);

    return (
      <View style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: initialUrl.current }}
          style={styles.webview}
          javaScriptEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowFileAccess={false}
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={settings.webviewDebug}
          pullToRefreshEnabled={Platform.OS === 'ios' && settings.pullToRefresh}
          userAgent={settings.desktopSite ? DESKTOP_UA : undefined}
          textZoom={contentZoom(settings.contentSize)}
          injectedJavaScriptBeforeContentLoaded={bridge}
          onLoadStart={event => handleLoadStart(event.nativeEvent.url)}
          onLoadProgress={event => {
            if (page.current.loaded || !gate.isCurrent(page.current.id)) return;
            const next = Math.min(94, Math.round(event.nativeEvent.progress * 100));
            setProgress(next);
            setStatus(progressStatus(next));
          }}
          onLoad={event => void handleLoad(event.nativeEvent.url)}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigation}
          onScroll={event => {
            webScrollY.current = event.nativeEvent.contentOffset.y;
          }}
          onTouchStart={event => {
            if (
              Platform.OS === 'android' &&
              settings.pullToRefresh &&
              webScrollY.current <= 1
            ) {
              pullStartY.current = event.nativeEvent.pageY;
              pullTriggered.current = false;
            } else {
              pullStartY.current = null;
            }
          }}
          onTouchMove={event => {
            if (
              Platform.OS !== 'android' ||
              !settings.pullToRefresh ||
              pullStartY.current == null ||
              pullTriggered.current ||
              webScrollY.current > 1
            ) {
              return;
            }
            if (event.nativeEvent.pageY - pullStartY.current >= 72) {
              pullTriggered.current = true;
              showOverlay('Refreshing DMZ Ranked…', 0);
              webRef.current?.reload();
            }
          }}
          onTouchEnd={() => {
            pullStartY.current = null;
            pullTriggered.current = false;
          }}
          onShouldStartLoadWithRequest={handleShouldStart}
          onError={event => {
            if (event.nativeEvent.url === page.current.url) failLoad(page.current.id, 'network');
          }}
          onHttpError={event => {
            if (event.nativeEvent.url === page.current.url && event.nativeEvent.statusCode >= 400) {
              failLoad(page.current.id, 'network');
            }
          }}
          onFileDownload={() =>
            Alert.alert(
              'DMZ Ranked',
              'Downloads are disabled in this unofficial client.'
            )
          }
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        />

        {!overlayVisible && loading && progress < 100 ? (
          <View style={styles.topTrack}>
            <View style={[styles.topFill, { width: `${progress}%` }]} />
          </View>
        ) : null}

        {overlayVisible ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
          >
            <LoadingOverlay
              channel={channel}
              progress={progress}
              status={status}
              verbose={settings.verboseLoading}
              animations={settings.appAnimations}
            />
          </Animated.View>
        ) : null}

        {failed ? (
          <View style={styles.offline}>
            <View style={styles.offlineCard}>
              <Text style={styles.eyebrow}>DMZ RANKED</Text>
              <Text style={styles.offlineTitle}>
                RANKED <Text style={styles.gold}>{failureKind === 'interface' ? 'NOT READY' : 'OFFLINE'}</Text>
              </Text>
              <View style={styles.connectionChip}>
                <Text style={styles.connectionText}>
                  <Text style={styles.green}>●</Text> {failureKind === 'interface' ? 'APP INTERFACE UNAVAILABLE' : 'CONNECTION LOST'}
                </Text>
              </View>
              <Text style={styles.offlineCopy}>
                {failureKind === 'interface'
                  ? 'The app interface could not finish loading. Retry to load the complete DMZ Ranked app.'
                  : 'DMZ Ranked could not load. Check your connection, then reconnect to the leaderboard.'}
              </Text>
              <Pressable style={styles.retry} onPress={retry}>
                <Text style={styles.retryText}>RETRY DMZ RANKED</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  webview: { flex: 1, backgroundColor: colors.black },
  topTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1D2325'
  },
  topFill: { height: 2, backgroundColor: colors.gold },
  offline: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.black
  },
  offlineCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4A504D',
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    padding: 28,
    backgroundColor: colors.panel
  },
  eyebrow: {
    color: colors.goldSoft,
    fontFamily: condensedFont,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.6
  },
  offlineTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 38,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 8
  },
  gold: { color: colors.gold },
  connectionChip: {
    alignSelf: 'flex-start',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#374039',
    borderRadius: 6,
    backgroundColor: '#101512',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  connectionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900'
  },
  green: { color: colors.green },
  offlineCopy: { color: colors.muted, lineHeight: 22 },
  retry: {
    marginTop: 20,
    borderRadius: 6,
    padding: 13,
    alignItems: 'center',
    backgroundColor: colors.gold
  },
  retryText: {
    color: colors.black,
    fontWeight: '900',
    letterSpacing: 1
  }
});
