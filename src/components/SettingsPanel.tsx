import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { DmzDialog } from './DmzDialog';
import { DmzIcon } from './DmzIcon';
import { DmzActionCard, DmzCard, DmzGoldButton } from './DmzSurface';
import { verifyDeveloperPin } from '../services/developerGate';
import {
  exportOperatorBackups,
  operatorBackupCount,
  operatorNames
} from '../services/operatorBackup';
import { getLastNotificationSync } from '../services/backgroundNotificationSync';
import type { AppSettings, ContentSize } from '../types';
import { colors, condensedFont, contentScaleFactor } from '../theme';
import { AppSafeArea } from './AppSafeArea';
import { getWebViewPackage } from '../../modules/dmz-migration';

const PAYPAL_URL = 'https://share.google/9nj1GcaYNu3qJTTeu';
const KOFI_URL = 'https://ko-fi.com/harleytg_#checkoutModal';
const APP_SUPPORT_DISCORD = 'https://discord.gg/kdHneTZkyd';
const MAIN_DISCORD = 'https://discord.gg/jTaTHqw45F';
const BETA_GROUP = 'https://groups.google.com/g/dmz-ranked';
const TICKER_BUILDER = 'https://dmz-ticker.netlify.app';
const OBS_BUILDER = 'https://dmz-themed-obs.netlify.app';
const YOLANDO_AVATAR =
  'https://cdn.discordapp.com/avatars/645842556898377728/b2c3a2a0001bc2d946ae52aeaa9abe1c.webp?size=3072';
const DCHINZ_AVATAR =
  'https://cdn.discordapp.com/avatars/364411414787653642/71fc7b2b2cae4b81c38ad148aed61df3.webp?size=3072';

const DEV_UNLOCK_TAPS = 5;
const DEV_TAP_WINDOW_MS = 4500;
const DEV_MAX_PIN_ATTEMPTS = 5;
const DEV_PIN_LOCKOUT_MS = 30000;

export type SettingsAction =
  | { type: 'reload' }
  | { type: 'clear-cache' }
  | { type: 'clear-data' }
  | { type: 'save-operator' }
  | { type: 'refresh-operator' }
  | { type: 'select-operator'; operatorName: string }
  | { type: 'restore-operator'; operatorName: string }
  | { type: 'open-app-tab' }
  | { type: 'test-notification' }
  | { type: 'check-updates' }
  | { type: 'open-play-store' }
  | { type: 'open-notification-settings' }
  | { type: 'add-widget' }
  | { type: 'refresh-widgets' }
  | { type: 'peer-import' }
  | { type: 'feedback' };

type Props = {
  visible: boolean;
  settings: AppSettings;
  channel: 'stable' | 'beta';
  backupRevision: number;
  updateStatus: string;
  onClose: () => void;
  onUpdate: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  onReset: () => void;
  onAction: (action: SettingsAction) => void;
};

type DialogMode =
  | 'developer-pin'
  | 'operator-picker'
  | 'clear-data'
  | 'reset-settings'
  | null;

function matches(query: string, keywords: string): boolean {
  return !query || keywords.toLowerCase().includes(query);
}

function SectionLabel({
  children,
  danger = false
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Text style={[styles.section, danger && styles.sectionDanger]}>
      {children}
    </Text>
  );
}

function GoldAction({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <DmzGoldButton>
        <View style={styles.goldButtonInner}>
          <Text style={styles.goldButtonText}>{label}</Text>
        </View>
      </DmzGoldButton>
    </Pressable>
  );
}

function ToggleCard({
  title,
  summary,
  value,
  onChange
}: {
  title: string;
  summary: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.cardGap}>
      <DmzCard>
        <Pressable style={styles.toggleCard} onPress={() => onChange(!value)}>
          <View style={styles.flexCopy}>
            <Text style={styles.cardTitleCondensed}>{title}</Text>
            <Text style={styles.cardSummary}>{summary}</Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: '#3A4141', true: '#A87C26' }}
            thumbColor={value ? colors.gold : '#C8CDCA'}
          />
        </Pressable>
      </DmzCard>
    </View>
  );
}

function ActionCard({
  title,
  summary,
  label,
  danger,
  icon,
  onPress
}: {
  title: string;
  summary: string;
  label: string;
  danger?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <View style={styles.cardGap}>
      <Pressable onPress={onPress}>
        <DmzActionCard>
          <View style={styles.actionCard}>
            {icon ? <View style={styles.leadingIcon}>{icon}</View> : null}
            <View style={styles.flexCopy}>
              <Text style={styles.actionTitle}>{title}</Text>
              <Text style={styles.cardSummary}>{summary}</Text>
            </View>
            {danger ? (
              <View style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>{label}</Text>
              </View>
            ) : (
              <GoldAction label={label} onPress={onPress} />
            )}
          </View>
        </DmzActionCard>
      </Pressable>
    </View>
  );
}

export function SettingsPanel({
  visible,
  settings,
  channel,
  backupRevision,
  updateStatus,
  onClose,
  onUpdate,
  onReset,
  onAction
}: Props) {
  const version = Application.nativeApplicationVersion ?? '1.0.65';
  const build = Application.nativeBuildVersion ?? '169';
  const [query, setQuery] = useState('');
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const [backupNames, setBackupNames] = useState<string[]>([]);
  const [backupCount, setBackupCount] = useState(0);
  const [notificationStatus, setNotificationStatus] =
    useState('Checking notification permission…');
  const [lastSyncText, setLastSyncText] = useState('Not checked yet');
  const [webViewPackageText, setWebViewPackageText] = useState('Unknown');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const developerTapCount = useRef(0);
  const developerTapStarted = useRef(0);
  const developerFailures = useRef(0);
  const developerLockoutUntil = useRef(0);
  const searchEntry = useRef(new Animated.Value(1)).current;
  const contentEntry = useRef(new Animated.Value(1)).current;

  const q = query.trim().toLowerCase();

  const refreshBackupState = async () => {
    setBackupNames(await operatorNames());
    setBackupCount(await operatorBackupCount());
  };

  useEffect(() => {
    if (!visible) return;
    void refreshBackupState();
    void Notifications.getPermissionsAsync().then(permission => {
      setNotificationStatus(
        permission.status === 'granted'
          ? 'Notifications allowed'
          : 'Notification permission not granted'
      );
    });
    void getLastNotificationSync().then(sync => {
      if (!sync) {
        setLastSyncText('Not checked yet');
        return;
      }
      const stamp = new Date(sync.at).toLocaleString();
      setLastSyncText(`${sync.result} • ${stamp}`);
    });
    void getWebViewPackage().then(info => {
      setWebViewPackageText(
        info
          ? `${info.packageName} ${info.versionName}`.trim()
          : 'Unknown'
      );
    });
  }, [backupRevision, visible]);

  useEffect(() => {
    if (!visible) return;

    searchEntry.stopAnimation();
    contentEntry.stopAnimation();

    if (!settings.appAnimations) {
      searchEntry.setValue(1);
      contentEntry.setValue(1);
      return;
    }

    searchEntry.setValue(0);
    contentEntry.setValue(0);

    const entry = Animated.parallel([
      Animated.timing(searchEntry, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(contentEntry, {
        toValue: 1,
        duration: 240,
        delay: 45,
        useNativeDriver: true
      })
    ]);

    entry.start();
    return () => entry.stop();
  }, [
    contentEntry,
    searchEntry,
    settings.appAnimations,
    visible
  ]);

  useEffect(() => {
    if (
      q &&
      matches(
        q,
        'credits creator creators yolando dchinz harley studios harleytg harley-the-gamer paypal ko-fi support donate'
      )
    ) {
      setCreditsExpanded(true);
    }
  }, [q]);

  const contentSummary = useMemo(() => {
    if (settings.contentSize === 'compact') {
      return 'Compact • smaller cards, controls, text, and website content.';
    }
    if (settings.contentSize === 'large') {
      return 'Large • larger cards, controls, text, and website content.';
    }
    return 'Standard • default app and website sizing.';
  }, [settings.contentSize]);

  const operatorStatus = settings.selectedOperator
    ? [
        settings.selectedOperator,
        settings.operatorVerified ? 'Verified on this device' : 'Detected',
        settings.operatorProtected ? 'Protected' : 'Not protected'
      ].join(' • ')
    : 'Open DMZRanked.com in the app and select an operator.';

  const handleDeveloperTap = () => {
    const now = Date.now();
    if (
      developerTapStarted.current === 0 ||
      now - developerTapStarted.current > DEV_TAP_WINDOW_MS
    ) {
      developerTapStarted.current = now;
      developerTapCount.current = 0;
    }

    developerTapCount.current += 1;
    if (developerTapCount.current < DEV_UNLOCK_TAPS) return;

    developerTapCount.current = 0;
    developerTapStarted.current = 0;

    if (developerLockoutUntil.current > now) {
      setPin('');
      setPinError(
        `Try again in ${Math.max(
          1,
          Math.ceil((developerLockoutUntil.current - now) / 1000)
        )} seconds.`
      );
    } else {
      setPinError('');
    }
    setDialog('developer-pin');
  };

  const submitDeveloperPin = async () => {
    const now = Date.now();
    if (developerLockoutUntil.current > now) {
      setPinError(
        `Developer PIN temporarily locked. Try again in ${Math.max(
          1,
          Math.ceil((developerLockoutUntil.current - now) / 1000)
        )} seconds.`
      );
      return;
    }

    if (await verifyDeveloperPin(pin)) {
      developerFailures.current = 0;
      developerLockoutUntil.current = 0;
      setDeveloperUnlocked(true);
      setDialog(null);
      setPin('');
      setPinError('');
      return;
    }

    developerFailures.current += 1;
    setPin('');
    setPinError('Incorrect developer PIN');

    if (developerFailures.current >= DEV_MAX_PIN_ATTEMPTS) {
      developerFailures.current = 0;
      developerLockoutUntil.current = Date.now() + DEV_PIN_LOCKOUT_MS;
      setPinError(
        'Too many incorrect attempts. Developer access is locked for 30 seconds.'
      );
    }
  };

  const sizeButton = (size: ContentSize, label: string) => {
    const active = settings.contentSize === size;
    return (
      <Pressable
        onPress={() => onUpdate('contentSize', size)}
        style={[styles.sizeButton, active && styles.sizeButtonActive]}
      >
        <Text style={[styles.sizeButtonText, active && styles.sizeButtonTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  const copyDiagnostics = async () => {
    const report = [
      'DMZ Ranked Android Diagnostics',
      `App: ${version} (${build})`,
      `Package: ${Application.applicationId ?? 'unknown'}`,
      `Channel: ${channel}`,
      `Android: ${Device.osVersion ?? String(Platform.Version)} (API ${Device.platformApiLevel ?? String(Platform.Version)})`,
      `Device: ${[Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Unknown'}`,
      `WebView: ${webViewPackageText}`,
      `Notification permission: ${notificationStatus}`,
      `Website notifications: ${settings.siteNotifications ? 'On' : 'Off'}`,
      `Desktop website: ${settings.desktopSite ? 'On' : 'Off'}`,
      `Keep screen awake: ${settings.keepAwake ? 'On' : 'Off'}`,
      `Pull to refresh: ${settings.pullToRefresh ? 'On' : 'Off'}`,
      `Remember last page: ${settings.rememberLastPage ? 'On' : 'Off'}`,
      `Detailed loading: ${settings.verboseLoading ? 'On' : 'Off'}`,
      `WebView debugging: ${settings.webviewDebug ? 'On' : 'Off'}`,
      `Content size: ${settings.contentSize}`,
      `Operator: ${settings.selectedOperator || 'none'}`,
      `Operator backups: ${backupCount}`,
      `Last notification sync: ${lastSyncText}`
    ].join('\n');
    await Clipboard.setStringAsync(report);
  };

  const exportBackups = async () => {
    const raw = await exportOperatorBackups();
    await Clipboard.setStringAsync(raw);
  };

  const showAbout = matches(
    q,
    'dmz ranked about version build credits creator creators yolando dchinz harley studios harleytg harley-the-gamer gamer paypal ko-fi kofi support donate donation unofficial'
  );
  const showAppearance = matches(
    q,
    'appearance display size compact standard large zoom text content density animation motion fade transition smooth'
  );
  const showWidgets =
    channel === 'beta' &&
    Platform.OS === 'android' &&
    matches(q, 'widget home screen pin add refresh update rank sr standing operator beta');
  const showExperience = matches(
    q,
    'app experience desktop website layout keep screen awake pull refresh remember last page detailed verbose loading'
  );
  const showOperators = matches(
    q,
    'operators operator profile selected sync website backup restore autosave protected verified'
  );
  const showNotifications = matches(
    q,
    'notifications report review approval website alerts permission sound vibration test'
  );
  const showUpdates = matches(
    q,
    'app updates google play live update installed version check store'
  );
  const showPageActions = matches(q, 'page actions reload clear web cache');
  const showBeta =
    channel === 'beta' &&
    matches(q, 'beta program discord ticker builder obs themed experimental');
  const showHelp = matches(
    q,
    'help community feedback report support app website discord main group rankings rules server'
  );
  const showTransfer = matches(
    q,
    'app data transfer import other stable beta supported settings operator backups'
  );
  const showDanger = matches(
    q,
    'danger zone clear website data cookies storage reset settings defaults'
  );
  const showDeveloper =
    developerUnlocked &&
    matches(q, 'developer diagnostics runtime webview debugging copy lock');

  const any =
    showAbout ||
    showAppearance ||
    showWidgets ||
    showExperience ||
    showOperators ||
    showNotifications ||
    showUpdates ||
    showPageActions ||
    showBeta ||
    showHelp ||
    showTransfer ||
    showDanger ||
    showDeveloper;

  return (
    <Modal
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <AppSafeArea contentScale={contentScaleFactor(settings.contentSize)}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityLabel="Back"
            style={styles.backButton}
            onPress={onClose}
          >
            <DmzIcon name="back" size={24} />
          </Pressable>
          <Image
            source={require('../../assets/dmz_ranked_logo_display.png')}
            style={styles.toolbarLogo}
            resizeMode="contain"
          />
          <View style={styles.toolbarCopy}>
            <Text style={styles.toolbarTitle}>APP SETTINGS</Text>
            <Text style={styles.toolbarSubtitle}>
              Version {version} • Build {build}
            </Text>
          </View>
          <View style={styles.toolbarGoldLine} />
        </View>

        <Animated.View
          style={[
            styles.searchOuter,
            {
              opacity: searchEntry,
              transform: [
                {
                  translateY: searchEntry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0]
                  })
                }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={[colors.panel, colors.panelDeep]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.searchShell}
          >
            <DmzIcon name="search" size={21} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search app settings…"
              placeholderTextColor={colors.muted}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </LinearGradient>
        </Animated.View>

        <Animated.ScrollView
          style={[
            styles.scroll,
            {
              opacity: contentEntry,
              transform: [
                {
                  translateY: contentEntry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0]
                  })
                }
              ]
            }
          ]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {!any && q ? (
            <Text style={styles.empty}>
              No app settings match your search.
            </Text>
          ) : null}

          {showAbout ? (
            <DmzCard>
              <View style={styles.aboutCard}>
                <View style={styles.aboutTop}>
                  <Image
                    source={require('../../assets/dmz_ranked_logo_display.png')}
                    style={styles.aboutLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.aboutCopy}>
                    <View style={styles.aboutTitleRow}>
                      <Text style={styles.aboutTitle}>DMZ RANKED</Text>
                      {channel === 'beta' ? (
                        <Text style={styles.betaBadge}>BETA</Text>
                      ) : null}
                    </View>
                    <Text style={styles.aboutVersion}>Version {version}</Text>
                    <Text style={styles.aboutBuild}>Build {build}</Text>
                    <Text style={styles.unofficialClient}>
                      Unofficial {Platform.OS === 'android' ? 'Android' : 'iOS'} client
                    </Text>
                  </View>
                </View>

                <Text style={styles.creditsSummary}>
                  Website by YoLando &amp; dCHINZ • App by Harley&apos;s Studios
                </Text>

                <Pressable
                  onPress={() => setCreditsExpanded(value => !value)}
                  style={styles.creditsToggle}
                >
                  <Text style={styles.creditsToggleText}>
                    {creditsExpanded ? 'HIDE CREDITS' : 'VIEW CREDITS'}
                  </Text>
                </Pressable>

                {creditsExpanded ? (
                  <View style={styles.creditsContent}>
                    <Text style={styles.creditSectionLabel}>ANDROID APP</Text>
                    <Pressable
                      onPress={handleDeveloperTap}
                      style={styles.creditProfile}
                    >
                      <Image
                        source={require('../../assets/harleys_studios_about.png')}
                        style={styles.creditBrandLogo}
                        resizeMode="contain"
                      />
                      <View style={styles.flexCopy}>
                        <Text style={styles.creditName}>Harley&apos;s Studios</Text>
                        <Text style={styles.cardSummary}>
                          Built and maintained by Harley&apos;s Studios.
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.creditProfile}>
                      <Image
                        source={require('../../assets/harley_the_gamer_about.png')}
                        style={styles.creditBrandLogo}
                        resizeMode="contain"
                      />
                      <View style={styles.flexCopy}>
                        <Text style={styles.creditName}>HARLEY-THE-GAMER</Text>
                        <Text style={styles.cardSummary}>
                          HarleyTG • Harley&apos;s Studios
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.creditSectionLabel}>
                      DMZ RANKED WEBSITE
                    </Text>

                    <View style={styles.creatorRow}>
                      <Image
                        source={{ uri: YOLANDO_AVATAR }}
                        style={styles.avatar}
                      />
                      <View style={styles.flexCopy}>
                        <Text style={styles.creditName}>YoLando</Text>
                        <Text style={styles.cardSummary}>
                          DMZ Ranked creator • YouTube / Twitch
                        </Text>
                      </View>
                    </View>
                    <View style={styles.creatorRow}>
                      <Image
                        source={{ uri: DCHINZ_AVATAR }}
                        style={styles.avatar}
                      />
                      <View style={styles.flexCopy}>
                        <Text style={styles.creditName}>dCHINZ</Text>
                        <Text style={styles.cardSummary}>
                          DMZ Ranked co-creator
                        </Text>
                      </View>
                    </View>

                    <View style={styles.creditActionGap}>
                      <GoldAction
                        label="SUPPORT HARLEY'S STUDIOS ↗"
                        onPress={() => open(KOFI_URL)}
                      />
                    </View>
                    <View style={styles.creditActionGap}>
                      <GoldAction
                        label="SUPPORT DMZ RANKED CREATORS ↗"
                        onPress={() => open(PAYPAL_URL)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </DmzCard>
          ) : null}

          {showAppearance ? (
            <>
              <SectionLabel>APPEARANCE</SectionLabel>

              <DmzCard>
                <View style={styles.contentSizeCard}>
                  <Text style={styles.cardTitleCondensed}>Content size</Text>
                  <Text style={styles.cardSummary}>{contentSummary}</Text>
                  <View style={styles.sizeRow}>
                    {sizeButton('compact', 'COMPACT')}
                    <View style={styles.sizeSpacer} />
                    {sizeButton('standard', 'STANDARD')}
                    <View style={styles.sizeSpacer} />
                    {sizeButton('large', 'LARGE')}
                  </View>
                </View>
              </DmzCard>

              <ToggleCard
                title="App animations"
                summary="Animate app transitions, loading, dialogs, and title status."
                value={settings.appAnimations}
                onChange={value => onUpdate('appAnimations', value)}
              />
            </>
          ) : null}

          {showWidgets ? (
            <>
              <SectionLabel>BETA WIDGETS</SectionLabel>
              <ActionCard
                title="Add home screen widget"
                summary="Pin the DMZ Ranked operator rank, SR, standing, and live-status widget."
                label="BETA ONLY"
                onPress={() => onAction({ type: 'add-widget' })}
              />
              <ActionCard
                title="Refresh widgets"
                summary="Refresh every pinned DMZ Ranked widget now."
                label="REFRESH"
                onPress={() => onAction({ type: 'refresh-widgets' })}
              />
            </>
          ) : null}

          {showExperience ? (
            <>
              <SectionLabel>APP EXPERIENCE</SectionLabel>
              <ToggleCard
                title="Desktop website"
                summary="Request a desktop-sized DMZ Ranked layout. The page reloads when this changes."
                value={settings.desktopSite}
                onChange={value => onUpdate('desktopSite', value)}
              />
              <ToggleCard
                title="Keep screen awake"
                summary="Prevent the screen from sleeping while this app is open."
                value={settings.keepAwake}
                onChange={value => onUpdate('keepAwake', value)}
              />
              <ToggleCard
                title="Pull to refresh"
                summary="Swipe down from the top of the page to reload DMZ Ranked."
                value={settings.pullToRefresh}
                onChange={value => onUpdate('pullToRefresh', value)}
              />
              <ToggleCard
                title="Remember last page"
                summary="Reopen the last DMZ Ranked page you were viewing."
                value={settings.rememberLastPage}
                onChange={value => onUpdate('rememberLastPage', value)}
              />
              <ToggleCard
                title="Detailed loading status"
                summary="Show live loading status and percentage underneath the loading bar."
                value={settings.verboseLoading}
                onChange={value => onUpdate('verboseLoading', value)}
              />
            </>
          ) : null}

          {showOperators ? (
            <>
              <SectionLabel>OPERATORS</SectionLabel>

              <DmzCard>
                <View style={styles.operatorStatusCard}>
                  <View style={styles.operatorHeader}>
                    <DmzIcon name="globe" size={38} />
                    <View style={styles.operatorTitleCopy}>
                      <Text style={styles.operatorHeading}>OPERATORS</Text>
                      <Text style={styles.operatorSubtitle}>
                        Detected from DMZRanked.com
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onAction({ type: 'save-operator' })}
                      style={styles.syncButton}
                    >
                      <DmzIcon name="sync" size={22} />
                      <View style={styles.syncCopy}>
                        <Text style={styles.syncTitle}>SYNC</Text>
                        <Text style={styles.syncSubtitle}>From website</Text>
                      </View>
                    </Pressable>
                  </View>

                  <View style={styles.operatorInner}>
                    <View style={styles.operatorActiveRow}>
                      <Text style={styles.operatorName}>
                        {settings.selectedOperator || 'No operator selected'}
                      </Text>
                      {settings.selectedOperator ? (
                        <Text style={styles.activeBadge}>ACTIVE</Text>
                      ) : null}
                    </View>
                    <Text style={styles.operatorStatus}>{operatorStatus}</Text>
                    <Text style={styles.operatorCount}>
                      {backupCount} / 2 local operator backups
                    </Text>
                    {backupNames.length ? (
                      <Pressable
                        onPress={() => setDialog('operator-picker')}
                        style={styles.operatorListButton}
                      >
                        <Text style={styles.operatorListText}>
                          {backupNames.join('  •  ')}
                        </Text>
                        <Text style={styles.operatorPickerHint}>
                          PICK OPERATOR ›
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.operatorActions}>
                    <Pressable
                      style={styles.operatorAction}
                      onPress={() => {
                        onAction({ type: 'open-app-tab' });
                        onClose();
                      }}
                    >
                      <Text style={styles.operatorActionText}>
                        OPEN WEBSITE
                      </Text>
                    </Pressable>
                    <View style={styles.operatorActionSpacer} />
                    <Pressable
                      style={styles.operatorAction}
                      onPress={() => onAction({ type: 'refresh-operator' })}
                    >
                      <Text style={styles.operatorActionText}>REFRESH</Text>
                    </Pressable>
                  </View>
                </View>
              </DmzCard>

              <View style={styles.cardGap}>
                <DmzCard>
                  <View style={styles.backupCard}>
                    <Pressable
                      style={styles.backupHeader}
                      onPress={() =>
                        onUpdate('operatorAutoSave', !settings.operatorAutoSave)
                      }
                    >
                      <DmzIcon name="database" size={34} color={colors.gold} />
                      <View style={styles.backupTitleCopy}>
                        <Text style={styles.backupTitle}>BACKUP &amp; RESTORE</Text>
                        <Text style={styles.backupSubtitle}>
                          Keeps a local backup of the selected operator&apos;s safe website data.
                        </Text>
                      </View>
                      <Switch
                        value={settings.operatorAutoSave}
                        onValueChange={value =>
                          onUpdate('operatorAutoSave', value)
                        }
                        trackColor={{ false: '#3A4141', true: '#A87C26' }}
                        thumbColor={
                          settings.operatorAutoSave
                            ? colors.gold
                            : '#C8CDCA'
                        }
                      />
                    </Pressable>

                    <Text style={styles.backupSummary}>
                      {backupCount
                        ? `${backupCount} backup${backupCount === 1 ? '' : 's'} saved locally • maximum 2 operators`
                        : 'No operator backup saved yet.'}
                    </Text>

                    <View style={styles.backupActionRow}>
                      <Pressable
                        style={styles.backupActionButton}
                        onPress={() => onAction({ type: 'save-operator' })}
                      >
                        <Text style={styles.backupActionText}>BACKUP</Text>
                      </Pressable>
                      <View style={styles.backupActionSpacer} />
                      <Pressable
                        style={styles.backupActionButton}
                        onPress={() => setDialog('operator-picker')}
                      >
                        <Text style={styles.backupActionText}>RESTORE</Text>
                      </Pressable>
                      <View style={styles.backupActionSpacer} />
                      <Pressable
                        style={styles.backupActionButton}
                        onPress={() => void exportBackups()}
                      >
                        <Text style={styles.backupActionText}>COPY</Text>
                      </Pressable>
                    </View>
                  </View>
                </DmzCard>
              </View>
            </>
          ) : null}

          {showNotifications ? (
            <>
              <SectionLabel>NOTIFICATIONS</SectionLabel>
              <ToggleCard
                title="Website notifications"
                summary="Real-time DMZ Ranked report/review alerts use native notifications and background sync."
                value={settings.siteNotifications}
                onChange={value => onUpdate('siteNotifications', value)}
              />
              <ActionCard
                title="Notification settings"
                summary={notificationStatus}
                label="OPEN ›"
                icon={<DmzIcon name="notification" size={28} />}
                onPress={() =>
                  onAction({ type: 'open-notification-settings' })
                }
              />
              <ActionCard
                title="Test notification"
                summary={`Send a local DMZ Ranked test notification. Last sync: ${lastSyncText}`}
                label="TEST"
                onPress={() => onAction({ type: 'test-notification' })}
              />
            </>
          ) : null}

          {showUpdates ? (
            <>
              <SectionLabel>APP UPDATES</SectionLabel>
              <ActionCard
                title="Live Google Play updates"
                summary={updateStatus}
                label="CHECK NOW"
                onPress={() => onAction({ type: 'check-updates' })}
              />
              <ActionCard
                title="Open in Google Play"
                summary="Open the official Play Store listing for this Android app."
                label="OPEN ↗"
                onPress={() => onAction({ type: 'open-play-store' })}
              />
            </>
          ) : null}

          {showPageActions ? (
            <>
              <SectionLabel>PAGE ACTIONS</SectionLabel>
              <ActionCard
                title="Reload DMZ Ranked"
                summary="Reload the current DMZ Ranked website page."
                label="RELOAD"
                onPress={() => {
                  onAction({ type: 'reload' });
                  onClose();
                }}
              />
              <ActionCard
                title="Clear web cache"
                summary="Clear cached web resources without deleting website storage."
                label="CLEAR"
                onPress={() => onAction({ type: 'clear-cache' })}
              />
            </>
          ) : null}

          {showBeta ? (
            <>
              <SectionLabel>BETA PROGRAM</SectionLabel>
              <ActionCard
                title="App Beta Discord"
                summary="Open Harley's Studios app support for beta testing."
                label="OPEN ↗"
                onPress={() => open(APP_SUPPORT_DISCORD)}
              />
              <ActionCard
                title="DMZ Ticker Builder"
                summary="Open the DMZ ticker builder."
                label="OPEN ↗"
                onPress={() => open(TICKER_BUILDER)}
              />
              <ActionCard
                title="DMZ Themed OBS Builder"
                summary="Open the DMZ themed OBS overlay builder."
                label="OPEN ↗"
                onPress={() => open(OBS_BUILDER)}
              />
            </>
          ) : null}

          {showHelp ? (
            <>
              <SectionLabel>APP SUPPORT ZONE</SectionLabel>
              <ActionCard
                title="Report an app problem"
                summary={`Report ${Platform.OS === 'android' ? 'Android' : 'iOS'} client bugs, app loading, appearance, notifications, widgets, or request app features.`}
                label="OPEN ›"
                onPress={() => onAction({ type: 'feedback' })}
              />
              <ActionCard
                title="App Support Discord"
                summary="Use App Support for this unofficial client: app bugs, WebView/loading, appearance, notifications, widgets, compatibility, and app-only features."
                label="OPEN ↗"
                onPress={() => open(APP_SUPPORT_DISCORD)}
              />
              <ActionCard
                title="Join App Beta Group"
                summary="Testing access and beta-app discussion."
                label="OPEN ↗"
                onPress={() => open(BETA_GROUP)}
              />

              <SectionLabel>WEBSITE SUPPORT ZONE</SectionLabel>
              <ActionCard
                title="DMZ Ranked website support"
                summary="For dmzranked.com itself: website data, rankings, rules, raid/operator data, moderation, accounts, website behavior, or server-side issues."
                label="OPEN ↗"
                onPress={() => open(MAIN_DISCORD)}
              />
              <ActionCard
                title="Support DMZ Ranked creators"
                summary="Open the creators' website support/donation link."
                label="OPEN ↗"
                onPress={() => open(PAYPAL_URL)}
              />
            </>
          ) : null}

          {showTransfer ? (
            <>
              <SectionLabel>APP DATA TRANSFER</SectionLabel>
              <ActionCard
                title="Import from other app"
                summary="Copy supported settings and operator backups between stable and beta."
                label="IMPORT"
                icon={<DmzIcon name="sync" size={34} />}
                onPress={() => onAction({ type: 'peer-import' })}
              />
            </>
          ) : null}

          {showDanger ? (
            <>
              <SectionLabel danger>DANGER ZONE</SectionLabel>
              <ActionCard
                title="Clear website data"
                summary="Clear cache, cookies, and website storage. This can sign you out."
                label="CLEAR DATA"
                danger
                onPress={() => setDialog('clear-data')}
              />
              <ActionCard
                title="Reset app settings"
                summary="Restore app settings to defaults without deleting website cookies or site storage."
                label="RESET"
                danger
                onPress={() => setDialog('reset-settings')}
              />
            </>
          ) : null}

          {showDeveloper ? (
            <>
              <SectionLabel>DEVELOPER &amp; DIAGNOSTICS</SectionLabel>
              <DmzCard>
                <View style={styles.diagnosticsCard}>
                  <Text style={styles.actionTitle}>Runtime information</Text>
                  <Text style={styles.cardSummary}>
                    Android {Device.osVersion ?? String(Platform.Version)} • {[Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Unknown device'}
                    {'\n'}WebView: {webViewPackageText}
                    {'\n'}Notifications: {notificationStatus} • Desktop: {settings.desktopSite ? 'On' : 'Off'} • Pull refresh: {settings.pullToRefresh ? 'On' : 'Off'}
                    {'\n'}Remember page: {settings.rememberLastPage ? 'On' : 'Off'} • WebView debug: {settings.webviewDebug ? 'On' : 'Off'}
                  </Text>
                </View>
              </DmzCard>
              <ToggleCard
                title="WebView debugging"
                summary="Developer option. Allow inspection when supported by the native WebView build."
                value={settings.webviewDebug}
                onChange={value => onUpdate('webviewDebug', value)}
              />
              <ActionCard
                title="Copy diagnostic report"
                summary="Copy non-sensitive app, platform, WebView, permission, and setting details for support."
                label="COPY"
                onPress={() => void copyDiagnostics()}
              />
              <ActionCard
                title="Lock developer tools"
                summary="Hide developer controls again until the five-tap PIN unlock is completed."
                label="LOCK"
                onPress={() => setDeveloperUnlocked(false)}
              />
            </>
          ) : null}

          <Text style={styles.footerNotice}>
            Unofficial client. DMZ Ranked website content and third-party
            trademarks belong to their respective owners.
          </Text>
        </Animated.ScrollView>

        <DmzDialog
          visible={dialog === 'developer-pin'}
          title="DEVELOPER ACCESS"
          message="Enter the 4-digit developer PIN."
          positiveLabel="UNLOCK"
          negativeLabel="CANCEL"
          animations={settings.appAnimations}
          contentScale={contentScaleFactor(settings.contentSize)}
          input={{
            value: pin,
            placeholder: 'Developer PIN',
            secure: true,
            numeric: true,
            maxLength: 4,
            error: pinError,
            onChange: value => {
              setPin(value.replace(/\D/g, '').slice(0, 4));
              setPinError('');
            }
          }}
          onPositive={() => void submitDeveloperPin()}
          onNegative={() => {
            setDialog(null);
            setPin('');
            setPinError('');
          }}
        />

        <DmzDialog
          visible={dialog === 'operator-picker'}
          operatorPicker
          title="SELECT OPERATOR"
          message="Choose one of the local operator backups."
          negativeLabel="CANCEL"
          animations={settings.appAnimations}
          contentScale={contentScaleFactor(settings.contentSize)}
          choices={backupNames.map(name => ({
            label: name,
            selected:
              name.toLowerCase() ===
              settings.selectedOperator.toLowerCase(),
            onPress: () => {
              onAction({
                type: 'select-operator',
                operatorName: name
              });
              setDialog(null);
              onClose();
            }
          }))}
          onNegative={() => setDialog(null)}
        />

        <DmzDialog
          visible={dialog === 'clear-data'}
          danger
          title="CLEAR WEBSITE DATA?"
          message="Clear cache, cookies, and website storage. This can sign you out."
          positiveLabel="CLEAR DATA"
          negativeLabel="CANCEL"
          animations={settings.appAnimations}
          contentScale={contentScaleFactor(settings.contentSize)}
          onPositive={() => {
            onAction({ type: 'clear-data' });
            setDialog(null);
          }}
          onNegative={() => setDialog(null)}
        />

        <DmzDialog
          visible={dialog === 'reset-settings'}
          danger
          title="RESET APP SETTINGS?"
          message="Restore all app settings to their defaults."
          positiveLabel="RESET"
          negativeLabel="CANCEL"
          animations={settings.appAnimations}
          contentScale={contentScaleFactor(settings.contentSize)}
          onPositive={() => {
            onReset();
            setDialog(null);
          }}
          onNegative={() => setDialog(null)}
        />
      </AppSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  toolbar: {
    height: 74,
    backgroundColor: colors.toolbar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 6
  },
  toolbarGoldLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.gold
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolbarLogo: { width: 46, height: 46 },
  toolbarCopy: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginLeft: 8,
    marginRight: 6
  },
  toolbarTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontWeight: '900',
    fontSize: 21,
    letterSpacing: 0.4
  },
  toolbarSubtitle: {
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 10.5,
    marginTop: 2
  },
  searchOuter: {
    marginLeft: 16,
    marginTop: 12,
    marginRight: 16
  },
  searchShell: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.cardBorderGold,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  search: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    paddingVertical: 10,
    paddingLeft: 10
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    padding: 24,
    textAlign: 'center'
  },
  section: {
    marginLeft: 4,
    marginTop: 24,
    marginBottom: 10,
    color: colors.gold,
    fontFamily: condensedFont,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8
  },
  sectionDanger: { color: colors.red },
  cardGap: { marginTop: 10 },
  flexCopy: { flex: 1 },
  aboutCard: { padding: 16 },
  aboutTop: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  aboutLogo: { width: 72, height: 72 },
  aboutCopy: { flex: 1, marginLeft: 14 },
  aboutTitleRow: { flexDirection: 'row', alignItems: 'center' },
  aboutTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  betaBadge: {
    marginLeft: 8,
    minWidth: 40,
    textAlign: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    color: colors.black,
    fontFamily: condensedFont,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  aboutVersion: { marginTop: 3, color: colors.muted, fontSize: 13 },
  aboutBuild: { marginTop: 2, color: colors.muted, fontSize: 12 },
  unofficialClient: {
    marginTop: 6,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900'
  },
  creditsSummary: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  creditsToggle: {
    marginTop: 12,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.panelDeep
  },
  creditsToggleText: {
    color: colors.gold,
    fontFamily: condensedFont,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  creditsContent: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12
  },
  creditSectionLabel: {
    color: colors.gold,
    fontFamily: condensedFont,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 6
  },
  creditProfile: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  creditBrandLogo: { width: 58, height: 48, marginRight: 12 },
  creditName: { color: colors.white, fontSize: 15, fontWeight: '900' },
  creatorRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: colors.panelDeep
  },
  creditActionGap: { marginTop: 10 },
  goldButtonInner: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  goldButtonText: {
    color: colors.black,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  contentSizeCard: { padding: 16 },
  cardTitleCondensed: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 17,
    fontWeight: '900'
  },
  cardSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  sizeRow: { flexDirection: 'row', marginTop: 12 },
  sizeSpacer: { width: 8 },
  sizeButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.panelDeep,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sizeButtonActive: {
    borderColor: colors.gold,
    backgroundColor: '#161A18'
  },
  sizeButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900'
  },
  sizeButtonTextActive: { color: colors.white },
  toggleCard: {
    minHeight: 72,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionCard: {
    minHeight: 72,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  leadingIcon: { marginRight: 10 },
  actionTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900'
  },
  dangerButton: {
    marginLeft: 12,
    backgroundColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dangerButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900'
  },
  operatorStatusCard: { padding: 14 },
  operatorHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  operatorTitleCopy: { flex: 1, marginLeft: 10 },
  operatorHeading: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1
  },
  operatorSubtitle: { marginTop: 1, color: colors.muted, fontSize: 12 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 9,
    backgroundColor: '#0B1012',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  syncCopy: { marginLeft: 6 },
  syncTitle: { color: colors.white, fontSize: 11, fontWeight: '900' },
  syncSubtitle: { color: colors.muted, fontSize: 9 },
  operatorInner: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 9,
    backgroundColor: '#0B1012',
    padding: 12
  },
  operatorActiveRow: { flexDirection: 'row', alignItems: 'center' },
  operatorName: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '900'
  },
  activeBadge: {
    color: colors.black,
    backgroundColor: colors.gold,
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '900'
  },
  operatorStatus: { marginTop: 5, color: colors.muted, fontSize: 12 },
  operatorCount: { marginTop: 7, color: colors.goldSoft, fontSize: 11 },
  operatorListButton: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 8
  },
  operatorListText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  operatorPickerHint: {
    marginTop: 4,
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900'
  },
  operatorActions: { flexDirection: 'row', marginTop: 10 },
  operatorAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.panelDeep,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38
  },
  operatorActionSpacer: { width: 8 },
  operatorActionText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900'
  },
  backupCard: { padding: 14 },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backupTitleCopy: { flex: 1, marginLeft: 10, paddingRight: 8 },
  backupTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 18,
    fontWeight: '900'
  },
  backupSubtitle: { marginTop: 2, color: colors.muted, fontSize: 11 },
  backupSummary: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  backupActionRow: { flexDirection: 'row', marginTop: 10 },
  backupActionButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    backgroundColor: colors.panelDeep,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backupActionSpacer: { width: 8 },
  backupActionText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900'
  },
  diagnosticsCard: { padding: 16 },
  footerNotice: {
    marginTop: 22,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 10
  }
});
