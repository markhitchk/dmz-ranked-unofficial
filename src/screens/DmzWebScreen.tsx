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
  AppState,
  BackHandler,
  findNodeHandle,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Application from 'expo-application';
import { WebView } from 'react-native-webview';
import type { AppSettings } from '../types';
import { colors, condensedFont, contentScaleFactor } from '../theme';
import { LoadingOverlay } from '../components/LoadingOverlay';
import {
  loadRemoteAppUi,
  type RemoteAppUiPayload
} from '../services/remoteAppUi';
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
  latestOperatorBackup,
  saveOperatorBackup
} from '../services/operatorBackup';
import { normalizeBrowserUrlInput } from '../services/urlNavigation';
import {
  getDefaultWebViewUserAgent,
  installWebChromeParity
} from '../../modules/dmz-migration';

const HOME_URL = 'https://dmzranked.com/';

const ANDROID_PERFORMANCE_SCRIPT =
  Platform.OS === 'android'
    ? `
(function(){
  try{
    var root=document.documentElement;
    if(root){
      root.classList.add('hs-native-app','hs-android-webview');
      root.style.scrollBehavior='auto';
    }
    if(!window.__dmzScrollPerfInstalled){
      window.__dmzScrollPerfInstalled=true;
      window.__dmzAppScrolling=false;
      var dmzScrollIdleTimer=0;
      var markScrolling=function(){
        window.__dmzAppScrolling=true;
        clearTimeout(dmzScrollIdleTimer);
        dmzScrollIdleTimer=setTimeout(function(){
          window.__dmzAppScrolling=false;
        },180);
      };
      window.addEventListener('scroll',markScrolling,{passive:true});
      window.addEventListener('touchstart',markScrolling,{passive:true});
      window.addEventListener('touchmove',markScrolling,{passive:true});
      window.addEventListener('touchend',markScrolling,{passive:true});
      window.addEventListener('touchcancel',markScrolling,{passive:true});
    }
    if(!window.__dmzNativePullRefreshInstalled){
      window.__dmzNativePullRefreshInstalled=true;
      var dmzPullStartY=null;
      var dmzPullTriggered=false;
      document.addEventListener('touchstart',function(ev){
        if(!window.__dmzPullToRefreshEnabled||!ev.touches||ev.touches.length!==1){
          dmzPullStartY=null;
          return;
        }
        if((window.scrollY||document.documentElement.scrollTop||0)<=1){
          dmzPullStartY=ev.touches[0].clientY;
          dmzPullTriggered=false;
        }else{
          dmzPullStartY=null;
        }
      },{passive:true,capture:true});
      document.addEventListener('touchmove',function(ev){
        if(!window.__dmzPullToRefreshEnabled||dmzPullStartY===null||dmzPullTriggered||!ev.touches||!ev.touches.length)return;
        if((window.scrollY||document.documentElement.scrollTop||0)>1){
          dmzPullStartY=null;
          return;
        }
        if(ev.touches[0].clientY-dmzPullStartY>=72){
          dmzPullTriggered=true;
          try{
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'native-pull-refresh'}));
          }catch(_){}
        }
      },{passive:true,capture:true});
      var resetPull=function(){
        dmzPullStartY=null;
        dmzPullTriggered=false;
      };
      document.addEventListener('touchend',resetPull,{passive:true,capture:true});
      document.addEventListener('touchcancel',resetPull,{passive:true,capture:true});
    }
  }catch(e){}
  return true;
})();true;
`
    : '';

const URL_OBSERVER_SCRIPT = `
(function(){
  if(window.__dmzRnUrlObserverInstalled){return true;}
  window.__dmzRnUrlObserverInstalled=true;
  var notify=function(){
    try{
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'native-url',
        url:String(window.location.href||'')
      }));
    }catch(e){}
  };
  var wrapHistory=function(name){
    try{
      var original=window.history&&window.history[name];
      if(typeof original!=='function'){return;}
      window.history[name]=function(){
        var result=original.apply(this,arguments);
        setTimeout(notify,0);
        return result;
      };
    }catch(e){}
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');
  window.addEventListener('popstate',notify);
  window.addEventListener('hashchange',notify);
  setTimeout(notify,0);
  return true;
})();true;
`;

const IOS_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

function appUserAgentIdentity(): string {
  const version = Application.nativeApplicationVersion ?? '1.1.0';
  const packageName = Application.applicationId ?? 'com.harleytg.dmzranked';
  return `DMZRankedApp/${version} (HarleysStudios; AndroidClient; ${packageName})`;
}

function javaAndroidUserAgent(desktop: boolean): string | undefined {
  if (Platform.OS !== 'android') return undefined;

  const identity = appUserAgentIdentity();
  const mobile = getDefaultWebViewUserAgent();
  if (!mobile) {
    return desktop
      ? `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ${identity}`
      : undefined;
  }

  if (!desktop) return `${mobile} ${identity}`;

  const chromeToken = mobile.match(/Chrome\/[^\s]+/)?.[0] ?? 'Chrome/120.0.0.0';
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ${chromeToken} Safari/537.36 ${identity}`;
}

export type OperatorCaptureResult =
  | { ok: true; operatorName: string }
  | {
      ok: false;
      reason: 'not-dmz' | 'no-operator' | 'no-data' | 'capture-failed' | 'save-failed' | 'timeout';
    };

export type OperatorRestoreResult =
  | { ok: true; operatorName: string }
  | {
      ok: false;
      reason:
        | 'not-dmz'
        | 'missing-backup'
        | 'no-data'
        | 'switch-operator'
        | 'pin-required'
        | 'restore-failed';
      operatorName?: string;
    };

export type DmzNavigationState = {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
};

export type DmzWebHandle = {
  goBack: () => void;
  goForward: () => void;
  navigate: (url: string) => void;
  reload: () => void;
  clearCache: () => void;
  clearWebsiteData: () => void;
  refreshOperator: () => void;
  selectOperator: (operatorName: string) => Promise<boolean>;
  captureOperatorBackup: () => void;
  saveOperatorBackupNow: () => Promise<OperatorCaptureResult>;
  restoreOperatorBackup: (
    operatorName: string
  ) => Promise<OperatorRestoreResult>;
  openAppTab: () => void;
};

type Props = {
  settings: AppSettings;
  suspendBackgroundWork: boolean;
  channel: 'stable' | 'beta';
  onOpenSettings: (target?: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onNavigationChange?: (state: DmzNavigationState) => void;
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
    return false;
  }
}

function isAllowedExternal(url: string): boolean {
  try {
    const protocol = new URL(url).protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function contentZoom(size: AppSettings['contentSize']): number {
  if (size === 'compact') return 96;
  if (size === 'large') return 104;
  return 100;
}

function showLinkMessage(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('DMZ Ranked', message);
  }
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    showLinkMessage('No app can open this link.');
  }
}

export const DmzWebScreen = forwardRef<DmzWebHandle, Props>(
  function DmzWebScreen(
    {
      settings,
      suspendBackgroundWork,
      channel,
      onOpenSettings,
      onLoadingChange,
      onNavigationChange,
      onUpdateSetting,
      onOperatorBackupSaved
    },
    ref
  ) {
    const webRef = useRef<WebView>(null);
    const webHostRef = useRef<View>(null);
    const userAgent = useMemo(
      () =>
        Platform.OS === 'android'
          ? javaAndroidUserAgent(settings.desktopSite)
          : settings.desktopSite
            ? IOS_DESKTOP_UA
            : undefined,
      [settings.desktopSite]
    );
    const applicationNameForUserAgent =
      Platform.OS === 'android' ? appUserAgentIdentity() : 'DMZRankedApp';
    const initialUrl = useRef(
      settings.rememberLastPage
        ? settings.lastPageUrl || HOME_URL
        : HOME_URL
    );
    const [loading, setLoading] = useState(true);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Starting DMZ Ranked…');
    const [navProgress, setNavProgress] = useState(0);
    const [navProgressVisible, setNavProgressVisible] = useState(false);
    const [failed, setFailed] = useState(false);
    const [failureKind, setFailureKind] = useState<'network' | 'interface'>('network');
    const overlayOpacity = useRef(new Animated.Value(1)).current;
    const navProgressOpacity = useRef(new Animated.Value(0)).current;
    const gate = useRef(new AppUiLoadGate()).current;
    const page = useRef({
      id: 0,
      url: initialUrl.current,
      loaded: false,
      uiStarted: false,
      requiresOverrides: settings.appUiOverrides
    });
    const startupComplete = useRef(false);
    const forceOverlayNextNavigation = useRef(false);
    const payload = useRef<Promise<RemoteAppUiPayload> | null>(null);
    const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canGoBack = useRef(false);
    const canGoForward = useRef(false);
    const previousDesktopMode = useRef(settings.desktopSite);
    const liveOperator = useRef({
      name: '',
      verified: false,
      protected: false
    });
    const restoreRequestSequence = useRef(0);
    const lastAutoBackupMs = useRef(0);
    const restoreRequests = useRef(
      new Map<
        string,
        {
          timer: ReturnType<typeof setTimeout>;
          resolve: (result: string) => void;
        }
      >()
    );

    useEffect(() => {
      if (Platform.OS !== 'android') return;
      // Keep the WebView mounted; only pause expensive DOM checks behind modals.
      webRef.current?.injectJavaScript(
        `window.__dmzAppPaused=${suspendBackgroundWork ? 'true' : 'false'};` +
        (suspendBackgroundWork
          ? ''
          : 'if(window.__dmzRnRevalidateAppUi){window.__dmzRnRevalidateAppUi();}') +
        'true;'
      );
    }, [suspendBackgroundWork]);

    useEffect(() => {
      if (Platform.OS !== 'android') return;
      webRef.current?.injectJavaScript(
        `window.__dmzPullToRefreshEnabled=${settings.pullToRefresh ? 'true' : 'false'};true;`
      );
    }, [settings.pullToRefresh]);

    const installBrowserDialogParity = useCallback(() => {
      if (Platform.OS !== 'android' || !webHostRef.current) return;
      const reactTag = findNodeHandle(webHostRef.current);
      if (typeof reactTag !== 'number') return;

      void installWebChromeParity(
        reactTag,
        settings.appAnimations,
        contentScaleFactor(settings.contentSize)
      );
    }, [settings.appAnimations, settings.contentSize]);

    useEffect(() => {
      installBrowserDialogParity();
    }, [installBrowserDialogParity]);

    const clearLoadTimers = useCallback(() => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (readyTimer.current) clearTimeout(readyTimer.current);
      if (backupTimer.current) clearTimeout(backupTimer.current);
      if (navHideTimer.current) clearTimeout(navHideTimer.current);
      finishTimer.current = readyTimer.current = backupTimer.current = navHideTimer.current = null;
    }, []);

    useEffect(() => () => {
      gate.cancel();
      clearLoadTimers();
      overlayOpacity.stopAnimation();
      navProgressOpacity.stopAnimation();
      for (const pending of restoreRequests.current.values()) {
        clearTimeout(pending.timer);
        pending.resolve('error:cancelled');
      }
      restoreRequests.current.clear();
    }, [clearLoadTimers, gate, navProgressOpacity, overlayOpacity]);

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
      forceOverlayNextNavigation.current = true;
      webRef.current?.reload();
    }, [settings.desktopSite]);

    const bridge = useMemo(
      () => createBridgeBootstrap(channel, settings.selectedOperator),
      [channel, settings.selectedOperator]
    );

    const revalidateWebLifecycle = useCallback(() => {
      if (!webRef.current) return;
      const preferred = settings.selectedOperator.trim();
      webRef.current.injectJavaScript(
        `(function(){try{
          window.__DMZ_RN_PREFERRED_OPERATOR=${JSON.stringify(preferred)};
          if(window.__dmzRnRefreshOperatorLifecycle){window.__dmzRnRefreshOperatorLifecycle();}
          if(window.__dmzRnRevalidateAppUi){window.__dmzRnRevalidateAppUi();}
        }catch(e){}})();true;`
      );
    }, [settings.selectedOperator]);

    useEffect(() => {
      const subscription = AppState.addEventListener('change', nextState => {
        if (nextState !== 'active') return;
        installBrowserDialogParity();
        setTimeout(revalidateWebLifecycle, 120);
        setTimeout(revalidateWebLifecycle, 900);
      });
      return () => subscription.remove();
    }, [installBrowserDialogParity, revalidateWebLifecycle]);

    useEffect(() => {
      if (loading) return;
      const timer = setTimeout(revalidateWebLifecycle, 120);
      return () => clearTimeout(timer);
    }, [loading, revalidateWebLifecycle, settings.contentSize]);

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

    const applyPreferredOperator = useCallback(
      (operatorName: string, force = false) => {
        const name = operatorName.trim();
        if (!name || !webRef.current) return false;
        webRef.current.injectJavaScript(
          `(function(){try{window.__DMZ_RN_PREFERRED_OPERATOR=${JSON.stringify(
            name
          )};if(window.__dmzRnApplyPreferredOperator){window.__dmzRnApplyPreferredOperator(${JSON.stringify(
            name
          )},0,${force ? 'true' : 'false'});}else if(window.__dmzRnRefreshOperatorLifecycle){window.__dmzRnRefreshOperatorLifecycle();}}catch(e){}})();true;`
        );
        return true;
      },
      []
    );

    const selectOperator = useCallback(
      async (operatorName: string): Promise<boolean> =>
        applyPreferredOperator(operatorName, true),
      [applyPreferredOperator]
    );

    useEffect(() => {
      const savedOperator = settings.selectedOperator.trim();
      if (!savedOperator || loading || !webRef.current) return;
      applyPreferredOperator(savedOperator, false);
    }, [applyPreferredOperator, loading, settings.selectedOperator]);

    const captureOperatorBackup = useCallback(() => {
      webRef.current?.injectJavaScript(
        'if(window.__dmzRnCaptureBackup){window.__dmzRnCaptureBackup();}true;'
      );
    }, []);

    const restoreOperatorBackup = useCallback(
      async (operatorName: string): Promise<OperatorRestoreResult> => {
        if (!webRef.current || !isInternal(page.current.url)) {
          return { ok: false, reason: 'not-dmz' };
        }

        const requestedName = operatorName.trim();
        const record =
          (requestedName ? await getOperatorBackup(requestedName) : null) ??
          (await latestOperatorBackup());
        if (!record) {
          return { ok: false, reason: 'missing-backup' };
        }

        const script = buildOperatorRestoreScript(record);
        if (!script) {
          return {
            ok: false,
            reason: 'no-data',
            operatorName: record.operator
          };
        }

        const live = liveOperator.current;
        const liveName = live.name.trim();
        const sameOperator =
          Boolean(liveName) &&
          liveName.toLowerCase() === record.operator.toLowerCase();

        if (liveName && !sameOperator) {
          return {
            ok: false,
            reason: 'switch-operator',
            operatorName: record.operator
          };
        }

        const pinRequired =
          record.protected || (sameOperator && live.protected);
        if (pinRequired && (!sameOperator || !live.verified)) {
          return {
            ok: false,
            reason: 'pin-required',
            operatorName: record.operator
          };
        }

        const requestId =
          'restore-' +
          Date.now().toString(36) +
          '-' +
          (++restoreRequestSequence.current).toString(36);

        const result = await new Promise<string>(resolve => {
          const timer = setTimeout(() => {
            restoreRequests.current.delete(requestId);
            resolve('error:timeout');
          }, 4000);

          restoreRequests.current.set(requestId, { timer, resolve });
          webRef.current?.injectJavaScript(
            `(function(){try{var result=${script};window.ReactNativeWebView.postMessage(JSON.stringify({type:'operator-restore-result',requestId:${JSON.stringify(
              requestId
            )},result:String(result||'')}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'operator-restore-result',requestId:${JSON.stringify(
              requestId
            )},result:'error:'+String(e&&e.message||e)}));}})();true;`
          );
        });

        if (!result.startsWith('restored:')) {
          return {
            ok: false,
            reason: 'restore-failed',
            operatorName: record.operator
          };
        }

        onUpdateSetting('selectedOperator', record.operator);
        onUpdateSetting('operatorProtected', record.protected);
        onUpdateSetting('operatorSyncMs', Date.now());
        webRef.current?.injectJavaScript(
          'if(window.__dmzRnReadOperator){window.__dmzRnReadOperator();}location.reload();true;'
        );
        return { ok: true, operatorName: record.operator };
      },
      [onUpdateSetting]
    );

    useImperativeHandle(
      ref,
      () => ({
        goBack: () => {
          if (canGoBack.current) webRef.current?.goBack();
        },
        goForward: () => {
          if (canGoForward.current) webRef.current?.goForward();
        },
        navigate: value => {
          const target = normalizeBrowserUrlInput(value);
          if (!target) {
            showLinkMessage('Enter a valid web address.');
            return;
          }
          if (isInternal(target)) {
            webRef.current?.injectJavaScript(
              `window.location.assign(${JSON.stringify(target)});true;`
            );
            return;
          }
          if (isAllowedExternal(target)) {
            void openExternalUrl(target);
            return;
          }
          showLinkMessage('External link blocked.');
        },
        reload: () => {
          forceOverlayNextNavigation.current = true;
          webRef.current?.reload();
        },
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
        selectOperator,
        captureOperatorBackup,
        restoreOperatorBackup,
        openAppTab: () => {
          webRef.current?.injectJavaScript(
            `(function(){var wanted=['UNOFFICIAL APP','DMZ RANKED APP','DMZ RANKED APP [UNOFFICIAL]'];var list=document.querySelectorAll('button,a,[role=button],[data-tab]');for(var i=0;i<list.length;i++){var t=String(list[i].innerText||list[i].textContent||'').replace(/\\s+/g,' ').trim().toUpperCase();if(wanted.indexOf(t)>=0){list[i].click();break;}}return true;})();true;`
          );
        }
      }),
      [captureOperatorBackup, refreshOperator, restoreOperatorBackup, selectOperator]
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
        startupComplete.current = true;
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
      startupComplete.current = true;
      setFailureKind(kind);

      // Java deliberately opens the normal website when the optional app-ui
      // payload cannot be downloaded, injected, or verified. Only actual page
      // / network failures replace the WebView with the retry state.
      if (kind === 'interface') {
        setFailed(false);
        return;
      }
      setFailed(true);
    }, [clearLoadTimers, gate, overlayOpacity, setLoadingState]);

    const showNavigationProgress = useCallback(() => {
      if (navHideTimer.current) {
        clearTimeout(navHideTimer.current);
        navHideTimer.current = null;
      }
      setNavProgress(0);
      setNavProgressVisible(true);
      navProgressOpacity.stopAnimation();

      if (!settings.appAnimations) {
        navProgressOpacity.setValue(1);
        return;
      }

      Animated.timing(navProgressOpacity, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true
      }).start();
    }, [navProgressOpacity, settings.appAnimations]);

    const hideNavigationProgress = useCallback(() => {
      setNavProgress(100);
      if (navHideTimer.current) clearTimeout(navHideTimer.current);
      navHideTimer.current = setTimeout(() => {
        navProgressOpacity.stopAnimation();
        if (!settings.appAnimations) {
          navProgressOpacity.setValue(0);
          setNavProgressVisible(false);
          return;
        }

        Animated.timing(navProgressOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true
        }).start(({ finished }) => {
          if (finished) setNavProgressVisible(false);
        });
      }, 90);
    }, [navProgressOpacity, settings.appAnimations]);

    const handleLoadStart = useCallback((url: string) => {
      clearLoadTimers();
      const id = gate.begin(settings.appUiOverrides);
      page.current = {
        id,
        url,
        loaded: false,
        uiStarted: false,
        requiresOverrides: settings.appUiOverrides
      };
      payload.current = settings.appUiOverrides ? loadRemoteAppUi() : null;
      // Attach a rejection handler immediately while the document is loading.
      void payload.current?.catch(() => undefined);
      setFailed(false);
      showNavigationProgress();

      const useFullOverlay =
        !startupComplete.current || forceOverlayNextNavigation.current;
      forceOverlayNextNavigation.current = false;
      if (useFullOverlay) {
        showOverlay('Connecting to dmzranked.com…', 5);
      } else {
        overlayOpacity.stopAnimation();
        overlayOpacity.setValue(0);
        setOverlayVisible(false);
        setProgress(5);
        setStatus('Connecting to dmzranked.com…');
        setLoadingState(true);
      }
    }, [
      clearLoadTimers,
      gate,
      overlayOpacity,
      setLoadingState,
      settings.appUiOverrides,
      showNavigationProgress,
      showOverlay
    ]);

    const applyDesktopViewport = useCallback(() => {
      if (!settings.desktopSite) return;
      webRef.current?.injectJavaScript(
        `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.setAttribute('content','width=1280, initial-scale=0.75, minimum-scale=0.25, maximum-scale=3, user-scalable=yes');document.documentElement.style.minWidth='1180px';}catch(e){}})();true;`
      );
    }, [settings.desktopSite]);

    const installAppUi = useCallback(
      async (id: number) => {
        const current = page.current;
        if (
          !gate.isCurrent(id) ||
          current.id !== id ||
          !current.requiresOverrides ||
          current.uiStarted
        ) {
          return;
        }

        current.uiStarted = true;
        setProgress(value => Math.max(value, 90));
        setStatus('Verifying the DMZ Ranked app interface…');
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => failLoad(id, 'interface'), 20000);

        try {
          const ui = await (payload.current ?? loadRemoteAppUi());
          if (!gate.isCurrent(id)) return;
          setProgress(value => Math.max(value, 94));
          setStatus(
            ui.source === 'remote'
              ? 'Applying the latest app interface…'
              : ui.source === 'cache'
                ? 'Applying the last verified app interface…'
                : 'Applying the bundled app interface…'
          );
          webRef.current?.injectJavaScript(
            bridge +
              '\n' +
              buildRemoteUiInjection(ui.css, ui.js, id, ui.revision)
          );
          setProgress(value => Math.max(value, 98));
          setStatus('Checking app styles and the App tab…');
        } catch {
          failLoad(id, 'interface');
        }
      },
      [bridge, failLoad, gate]
    );

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
      if (current.uiStarted) {
        hideOverlay(id);
        return;
      }
      await installAppUi(id);
    }, [applyDesktopViewport, gate, hideOverlay, installAppUi]);

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string; url?: string } }) => {
        const sourceUrl = event.nativeEvent.url ?? '';
        if (
          sourceUrl &&
          sourceUrl !== 'about:blank' &&
          !isInternal(sourceUrl)
        ) {
          return;
        }

        try {
          const nativeMessage = JSON.parse(event.nativeEvent.data) as {
            type?: string;
            url?: string;
          };
          if (nativeMessage?.type === 'native-pull-refresh') {
            if (Platform.OS === 'android' && settings.pullToRefresh) {
              ToastAndroid.show(
                'Refreshing DMZ Ranked…',
                ToastAndroid.SHORT
              );
              forceOverlayNextNavigation.current = true;
              showOverlay('Refreshing DMZ Ranked…', 0);
              webRef.current?.reload();
            }
            return;
          }

          if (
            nativeMessage?.type === 'native-url' &&
            typeof nativeMessage.url === 'string'
          ) {
            const nextUrl = nativeMessage.url.trim();
            if (
              nextUrl &&
              (isInternal(nextUrl) || nextUrl === 'about:blank')
            ) {
              if (settings.rememberLastPage && isInternal(nextUrl)) {
                onUpdateSetting('lastPageUrl', nextUrl);
              }
              onNavigationChange?.({
                url: nextUrl,
                canGoBack: canGoBack.current,
                canGoForward: canGoForward.current
              });
            }
            return;
          }
        } catch {
          // Normal app bridge messages are parsed below.
        }

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

        if (message.type === 'operator-restore-result') {
          const requestId = message.requestId?.trim() || '';
          const pending = restoreRequests.current.get(requestId);
          if (pending) {
            clearTimeout(pending.timer);
            restoreRequests.current.delete(requestId);
            pending.resolve(message.result ?? '');
          }
          return;
        }

        if (message.type === 'open-settings') {
          onOpenSettings(message.target);
          return;
        }

        if (message.type === 'notification' && settings.siteNotifications) {
          const title = message.title?.trim() || 'DMZ Ranked';
          const body = message.body?.trim() || 'New activity is available.';
          void recordForegroundNotification(title, body).then(() =>
            showWebsiteNotification(title, body)
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
          const previousName = liveOperator.current.name.trim();
          const operatorChanged =
            Boolean(nextName) &&
            previousName.toLowerCase() !== nextName.toLowerCase();
          const statusVisible = Boolean(message.statusVisible);

          liveOperator.current = {
            name: nextName,
            verified: statusVisible
              ? Boolean(message.verified)
              : operatorChanged
                ? false
                : liveOperator.current.verified,
            protected: statusVisible
              ? Boolean(message.protected)
              : operatorChanged
                ? false
                : liveOperator.current.protected
          };

          if (nextName) {
            onUpdateSetting('selectedOperator', nextName);
            onUpdateSetting('operatorSyncMs', Date.now());
          }
          if (statusVisible) {
            onUpdateSetting('operatorVerified', Boolean(message.verified));
            onUpdateSetting('operatorProtected', Boolean(message.protected));
          } else if (operatorChanged) {
            onUpdateSetting('operatorVerified', false);
            onUpdateSetting('operatorProtected', false);
          }
          if (typeof message.source === 'string') {
            onUpdateSetting('operatorSource', message.source);
          }
          if (
            nextName &&
            settings.operatorAutoSave &&
            Date.now() - lastAutoBackupMs.current >= 8000
          ) {
            lastAutoBackupMs.current = Date.now();
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
        onNavigationChange,
        onOpenSettings,
        onOperatorBackupSaved,
        onUpdateSetting,
        settings.operatorAutoSave,
        settings.pullToRefresh,
        settings.siteNotifications,
        showOverlay
      ]
    );

    const handleNavigation = useCallback(
      (nav: { url: string; canGoBack?: boolean; canGoForward?: boolean }) => {
        const back = Boolean(nav.canGoBack);
        const forward = Boolean(nav.canGoForward);
        canGoBack.current = back;
        canGoForward.current = forward;
        onNavigationChange?.({
          url: nav.url,
          canGoBack: back,
          canGoForward: forward
        });
        if (settings.rememberLastPage && isInternal(nav.url)) {
          onUpdateSetting('lastPageUrl', nav.url);
        }
        if (isInternal(nav.url) && !loading) {
          setTimeout(revalidateWebLifecycle, 120);
        }
      },
      [
        loading,
        onNavigationChange,
        onUpdateSetting,
        revalidateWebLifecycle,
        settings.rememberLastPage
      ]
    );

    const handleExternalUrl = useCallback((url: string) => {
      if (url.toLowerCase().startsWith('dmzranked-support:')) {
        try {
          const target = new URL(url).searchParams.get('url');
          if (target && isAllowedExternal(target)) {
            void openExternalUrl(target);
          } else {
            showLinkMessage('The website donation link is invalid.');
          }
        } catch {
          showLinkMessage('Could not open the website donation link.');
        }
        return true;
      }

      if (isAllowedExternal(url)) {
        void openExternalUrl(url);
        return true;
      }

      return false;
    }, []);

    const handleShouldStart = useCallback(
      (request: { url: string }) => {
        const url = request.url;
        if (isInternal(url) || url === 'about:blank') return true;

        if (!handleExternalUrl(url)) {
          showLinkMessage('External link blocked.');
        }
        return false;
      },
      [handleExternalUrl]
    );

    const handleOpenWindow = useCallback(
      (event: { nativeEvent: { targetUrl?: string } }) => {
        const url = event.nativeEvent.targetUrl?.trim() ?? '';
        if (!url || url === 'about:blank') return;

        if (isInternal(url)) {
          webRef.current?.injectJavaScript(
            `window.location.assign(${JSON.stringify(url)});true;`
          );
          return;
        }

        if (!handleExternalUrl(url)) {
          showLinkMessage('External link blocked.');
        }
      },
      [handleExternalUrl]
    );

    const retry = useCallback(async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;
      gate.cancel();
      clearLoadTimers();
      setFailed(false);
      forceOverlayNextNavigation.current = true;
      showNavigationProgress();
      showOverlay('Connecting to dmzranked.com…', 5);
      webRef.current?.reload();
    }, [
      clearLoadTimers,
      gate,
      showNavigationProgress,
      showOverlay
    ]);

    const progressStatus = useCallback((value: number) => {
      if (value < 20) return `Connecting… ${value}%`;
      if (value < 65) return `Loading DMZ Ranked… ${value}%`;
      if (value < 95) return `Loading page assets… ${value}%`;
      if (value < 100) return `Finishing up… ${value}%`;
      return 'Page loaded • waiting for live sync…';
    }, []);

    return (
      <View style={styles.container}>
        <View ref={webHostRef} style={styles.webHost}>
          <WebView
          ref={webRef}
          source={{ uri: initialUrl.current }}
          originWhitelist={['http://*', 'https://*', 'dmzranked-support://*']}
          style={styles.webview}
          overScrollMode="never"
          javaScriptEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowFileAccess={false}
          setSupportMultipleWindows
          onOpenWindow={handleOpenWindow}
          webviewDebuggingEnabled={settings.webviewDebug}
          pullToRefreshEnabled={Platform.OS === 'ios' && settings.pullToRefresh}
          userAgent={userAgent}
          applicationNameForUserAgent={
            Platform.OS === 'android' && userAgent
              ? undefined
              : applicationNameForUserAgent
          }
          textZoom={contentZoom(settings.contentSize)}
          injectedJavaScriptBeforeContentLoaded={
            (Platform.OS === 'android'
              ? `window.__dmzAppPaused=${suspendBackgroundWork ? 'true' : 'false'};window.__dmzPullToRefreshEnabled=${settings.pullToRefresh ? 'true' : 'false'};true;\n`
              : '') +
            bridge +
            '\n' +
            ANDROID_PERFORMANCE_SCRIPT +
            '\n' +
            URL_OBSERVER_SCRIPT
          }
          // Android may skip before-content injection on some navigations.
          // Reinstall the idempotent operator bridge after the DOM exists.
          injectedJavaScript={bridge}
          onLoadStart={event => {
            installBrowserDialogParity();
            handleLoadStart(event.nativeEvent.url);
          }}
          onLoadProgress={event => {
            const raw = Math.max(
              0,
              Math.min(100, Math.round(event.nativeEvent.progress * 100))
            );
            setNavProgress(raw);
            if (raw >= 100) hideNavigationProgress();

            if (page.current.loaded || !gate.isCurrent(page.current.id)) return;
            if (
              raw >= 68 &&
              page.current.requiresOverrides &&
              !page.current.uiStarted
            ) {
              void installAppUi(page.current.id);
            }
            if (!page.current.uiStarted) {
              const next = Math.min(89, raw);
              setProgress(next);
              setStatus(progressStatus(next));
            }
          }}
          onLoad={event => {
            hideNavigationProgress();
            void handleLoad(event.nativeEvent.url);
          }}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigation}
          onShouldStartLoadWithRequest={handleShouldStart}
          onError={event => {
            if (event.nativeEvent.url === page.current.url) failLoad(page.current.id, 'network');
          }}
          onHttpError={event => {
            if (event.nativeEvent.url === page.current.url && event.nativeEvent.statusCode >= 400) {
              failLoad(page.current.id, 'network');
            }
          }}
          onFileDownload={() => {
            const message =
              'Downloads are disabled in this unofficial client.';
            if (Platform.OS === 'android') {
              ToastAndroid.show(message, ToastAndroid.SHORT);
            } else {
              Alert.alert('DMZ Ranked', message);
            }
          }}
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
          />
        </View>

        {navProgressVisible && !overlayVisible ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.topTrack, { opacity: navProgressOpacity }]}
          >
            <View
              style={[
                styles.topFill,
                { width: `${Math.max(2, navProgress)}%` }
              ]}
            />
          </Animated.View>
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
  webHost: { flex: 1, backgroundColor: colors.black },
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
