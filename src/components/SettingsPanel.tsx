import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import type { AppSettings, ContentSize } from '../types';
import { colors, condensedFont } from '../theme';

export type SettingsAction =
  | 'reload'
  | 'clear-cache'
  | 'clear-data'
  | 'save-operator'
  | 'refresh-operator'
  | 'open-app-tab'
  | 'test-notification'
  | 'check-updates'
  | 'open-notification-settings'
  | 'add-widget'
  | 'refresh-widgets'
  | 'peer-import';

type Props = {
  visible: boolean;
  settings: AppSettings;
  channel: 'stable' | 'beta';
  onClose: () => void;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onReplaceSettings: (settings: AppSettings) => void;
  onReset: () => void;
  onAction: (action: SettingsAction) => void;
};

const PAYPAL_URL = 'https://share.google/9nj1GcaYNu3qJTTeu';
const KOFI_URL = 'https://ko-fi.com/harleytg_#checkoutModal';
const APP_SUPPORT_DISCORD = 'https://discord.gg/kdHneTZkyd';
const MAIN_DISCORD = 'https://discord.gg/jTaTHqw45F';
const BETA_GROUP = 'https://groups.google.com/g/dmz-ranked';
const TICKER_BUILDER = 'https://dmz-ticker.netlify.app';
const OBS_BUILDER = 'https://dmz-themed-obs.netlify.app';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function ToggleRow({
  title,
  summary,
  value,
  onValueChange
}: {
  title: string;
  summary: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable style={styles.row} onPress={() => onValueChange(!value)}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSummary}>{summary}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3C4140', true: colors.goldDark }}
        thumbColor={value ? colors.gold : '#D1D1D1'}
      />
    </Pressable>
  );
}

function ActionRow({
  title,
  summary,
  actionText,
  danger,
  onPress
}: {
  title: string;
  summary: string;
  actionText: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSummary}>{summary}</Text>
      </View>
      <View style={[styles.actionChip, danger && styles.dangerChip]}>
        <Text style={[styles.actionText, danger && styles.dangerText]}>
          {actionText}
        </Text>
      </View>
    </Pressable>
  );
}

function SizeButton({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.sizeButton, selected && styles.sizeButtonSelected]}
      onPress={onPress}
    >
      <Text style={[styles.sizeText, selected && styles.sizeTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SettingsPanel({
  visible,
  settings,
  channel,
  onClose,
  onUpdate,
  onReplaceSettings,
  onReset,
  onAction
}: Props) {
  const [query, setQuery] = useState('');
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const version = Application.nativeApplicationVersion ?? '1.0.61';
  const build = Application.nativeBuildVersion ?? '165';
  const q = query.trim().toLowerCase();

  const sectionVisible = (...keywords: string[]) =>
    !q || keywords.some(value => value.toLowerCase().includes(q));

  const operatorStatus = useMemo(() => {
    if (!settings.selectedOperator) {
      return 'No operator imported yet';
    }
    const states = [
      settings.operatorVerified ? 'Verified' : 'Detected',
      settings.operatorProtected ? 'Protected' : 'Not protected'
    ];
    return `${settings.selectedOperator} • ${states.join(' • ')}`;
  }, [
    settings.operatorProtected,
    settings.operatorVerified,
    settings.selectedOperator
  ]);

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  const backupOperator = async () => {
    const payload = JSON.stringify(
      {
        format: 'dmz-ranked-react-native-backup-v1',
        operator: {
          name: settings.selectedOperator,
          verified: settings.operatorVerified,
          protected: settings.operatorProtected,
          source: settings.operatorSource
        },
        settings
      },
      null,
      2
    );
    await Clipboard.setStringAsync(payload);
    Alert.alert('Operator backup', 'Backup copied to the clipboard.');
  };

  const restoreOperator = async () => {
    const value = await Clipboard.getStringAsync();
    try {
      const parsed = JSON.parse(value) as {
        format?: string;
        settings?: Partial<AppSettings>;
      };
      if (
        parsed.format !== 'dmz-ranked-react-native-backup-v1' ||
        !parsed.settings
      ) {
        throw new Error('invalid');
      }
      onReplaceSettings({ ...settings, ...parsed.settings });
      Alert.alert('Operator backup', 'Backup restored.');
    } catch {
      Alert.alert(
        'Operator backup',
        'The clipboard does not contain a valid DMZ Ranked backup.'
      );
    }
  };

  const copyDiagnostics = async () => {
    const report = [
      'DMZ Ranked diagnostics',
      `Version: ${version}`,
      `Build: ${build}`,
      `Channel: ${channel}`,
      `Platform: ${Platform.OS} ${String(Platform.Version)}`,
      `Operator: ${settings.selectedOperator || 'none'}`,
      `Verified: ${settings.operatorVerified}`,
      `Protected: ${settings.operatorProtected}`,
      `Content size: ${settings.contentSize}`,
      `Desktop site: ${settings.desktopSite}`,
      `Notifications: ${settings.siteNotifications}`
    ].join('\n');
    await Clipboard.setStringAsync(report);
    Alert.alert('Diagnostics', 'Diagnostic report copied.');
  };

  const setSize = (size: ContentSize) => onUpdate('contentSize', size);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityLabel="Back"
            style={styles.backButton}
            onPress={onClose}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Image
            source={require('../../assets/dmz_ranked_logo.png')}
            style={styles.toolbarLogo}
            resizeMode="contain"
          />

          <View style={styles.toolbarCopy}>
            <Text style={styles.toolbarTitle}>App Settings</Text>
            <Text style={styles.toolbarSubtitle}>
              DMZ Ranked {channel === 'beta' ? '• Beta' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search app settings…"
            placeholderTextColor="#737A76"
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {sectionVisible(
            'about version build credits harley studios dmz ranked yolando dchinz'
          ) ? (
            <Card>
              <View style={styles.aboutTop}>
                <Image
                  source={require('../../assets/dmz_ranked_logo.png')}
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
                  <Text style={styles.aboutMeta}>Version {version}</Text>
                  <Text style={styles.aboutMeta}>Build {build}</Text>
                </View>
              </View>

              <Pressable
                style={styles.creditsButton}
                onPress={() => setCreditsExpanded(value => !value)}
              >
                <Text style={styles.creditsButtonText}>
                  {creditsExpanded ? 'HIDE CREDITS' : 'CREDITS'}
                </Text>
              </Pressable>

              {creditsExpanded ? (
                <View style={styles.credits}>
                  <View style={styles.creditRow}>
                    <Image
                      source={require('../../assets/harleys_studios_about.png')}
                      style={styles.creditLogo}
                      resizeMode="contain"
                    />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>Harley&apos;s Studios</Text>
                      <Text style={styles.rowSummary}>
                        Built and maintained by Harley&apos;s Studios.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.creditRow}>
                    <Image
                      source={require('../../assets/harley_the_gamer_about.png')}
                      style={styles.creditLogo}
                      resizeMode="contain"
                    />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>HARLEY-THE-GAMER</Text>
                      <Text style={styles.rowSummary}>
                        HarleyTG • Harley&apos;s Studios
                      </Text>
                    </View>
                  </View>

                  <View style={styles.creditTextBlock}>
                    <Text style={styles.rowTitle}>DMZ RANKED WEBSITE</Text>
                    <Text style={styles.rowSummary}>
                      Website created by YoLando &amp; dCHINZ.
                    </Text>
                  </View>

                  <ActionRow
                    title="Support Harley's Studios on Ko-fi"
                    summary="Support development and maintenance of the unofficial DMZ Ranked app."
                    actionText="SUPPORT"
                    onPress={() => open(KOFI_URL)}
                  />
                  <ActionRow
                    title="Support DMZ Ranked creators via PayPal"
                    summary="Payments are for the DMZ Ranked website creators, not Harley's Studios."
                    actionText="PAYPAL"
                    onPress={() => open(PAYPAL_URL)}
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          {sectionVisible(
            'appearance content size compact standard large animations motion'
          ) ? (
            <>
              <SectionLabel>APPEARANCE</SectionLabel>
              <Card>
                <View style={styles.sizeRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Content size</Text>
                    <Text style={styles.rowSummary}>
                      Adjust the website scale inside the app.
                    </Text>
                  </View>
                  <View style={styles.sizeChoices}>
                    <SizeButton
                      label="COMPACT"
                      selected={settings.contentSize === 'compact'}
                      onPress={() => setSize('compact')}
                    />
                    <SizeButton
                      label="STANDARD"
                      selected={settings.contentSize === 'standard'}
                      onPress={() => setSize('standard')}
                    />
                    <SizeButton
                      label="LARGE"
                      selected={settings.contentSize === 'large'}
                      onPress={() => setSize('large')}
                    />
                  </View>
                </View>

                <ToggleRow
                  title="App animations"
                  summary="Animate loading, title status, and app transitions."
                  value={settings.appAnimations}
                  onValueChange={value => onUpdate('appAnimations', value)}
                />
              </Card>
            </>
          ) : null}

          {channel === 'beta' &&
          Platform.OS === 'android' &&
          sectionVisible('widget home screen add refresh rank sr standing') ? (
            <>
              <SectionLabel>HOME SCREEN WIDGETS</SectionLabel>
              <Card>
                <ActionRow
                  title="Add DMZ Ranked widget"
                  summary="Request the Android launcher to add the DMZ Ranked operator widget."
                  actionText="ADD"
                  onPress={() => onAction('add-widget')}
                />
                <ActionRow
                  title="Refresh widgets"
                  summary="Refresh rank, SR, standing, and live status on existing widgets."
                  actionText="REFRESH"
                  onPress={() => onAction('refresh-widgets')}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible(
            'app experience desktop keep awake refresh last page verbose loading'
          ) ? (
            <>
              <SectionLabel>APP EXPERIENCE</SectionLabel>
              <Card>
                <ToggleRow
                  title="Desktop website"
                  summary="Request a desktop-sized DMZ Ranked layout. The page reloads when this changes."
                  value={settings.desktopSite}
                  onValueChange={value => onUpdate('desktopSite', value)}
                />
                <ToggleRow
                  title="Keep screen awake"
                  summary="Prevent the screen from sleeping while this app is open."
                  value={settings.keepAwake}
                  onValueChange={value => onUpdate('keepAwake', value)}
                />
                <ToggleRow
                  title="Pull to refresh"
                  summary="Swipe down from the top of the page to reload DMZ Ranked."
                  value={settings.pullToRefresh}
                  onValueChange={value => onUpdate('pullToRefresh', value)}
                />
                <ToggleRow
                  title="Remember last page"
                  summary="Reopen the last DMZ Ranked page you were viewing."
                  value={settings.rememberLastPage}
                  onValueChange={value => onUpdate('rememberLastPage', value)}
                />
                <ToggleRow
                  title="Detailed loading status"
                  summary="Show live loading status and percentage underneath the loading bar."
                  value={settings.verboseLoading}
                  onValueChange={value => onUpdate('verboseLoading', value)}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible(
            'operator backup active verified protected picker save restore sync website'
          ) ? (
            <>
              <SectionLabel>OPERATOR &amp; BACKUP</SectionLabel>
              <Card>
                <View style={styles.operatorBlock}>
                  <View style={styles.operatorHeading}>
                    <Text style={styles.rowTitle}>Current operator</Text>
                    {settings.selectedOperator ? (
                      <Text style={styles.activeBadge}>ACTIVE</Text>
                    ) : null}
                  </View>
                  <Text style={styles.operatorStatus}>{operatorStatus}</Text>
                  {settings.operatorSource ? (
                    <Text style={styles.rowSummary}>
                      Source: {settings.operatorSource}
                    </Text>
                  ) : null}
                </View>

                <ActionRow
                  title="Save / refresh operator"
                  summary="Read the active operator directly from dmzranked.com and save it in the app."
                  actionText="SYNC"
                  onPress={() => onAction('save-operator')}
                />
                <ActionRow
                  title="Open website operator"
                  summary="Return to the DMZ Ranked app page to manage the operator on the website."
                  actionText="OPEN"
                  onPress={() => {
                    onAction('open-app-tab');
                    onClose();
                  }}
                />
                <ToggleRow
                  title="Operator auto-save"
                  summary="Keep the app's operator status synchronized while the site is open."
                  value={settings.operatorAutoSave}
                  onValueChange={value => onUpdate('operatorAutoSave', value)}
                />
                <ActionRow
                  title="Backup operator"
                  summary="Copy a portable app/operator backup to the clipboard."
                  actionText="BACKUP"
                  onPress={() => void backupOperator()}
                />
                <ActionRow
                  title="Restore operator"
                  summary="Restore a DMZ Ranked React Native backup from the clipboard."
                  actionText="RESTORE"
                  onPress={() => void restoreOperator()}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible(
            'notifications website alerts permission sound vibration test'
          ) ? (
            <>
              <SectionLabel>NOTIFICATIONS</SectionLabel>
              <Card>
                <ToggleRow
                  title="Website notifications"
                  summary="Mirror DMZ Ranked raid, review, season, and website events as native app notifications."
                  value={settings.siteNotifications}
                  onValueChange={value => onUpdate('siteNotifications', value)}
                />
                <ActionRow
                  title="Notification settings"
                  summary="Review system permission, sound, vibration, and notification controls."
                  actionText="OPEN"
                  onPress={() => onAction('open-notification-settings')}
                />
                <ActionRow
                  title="Test notification"
                  summary="Send a local DMZ Ranked test notification."
                  actionText="TEST"
                  onPress={() => onAction('test-notification')}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible('updates google play live update version store') ? (
            <>
              <SectionLabel>UPDATES</SectionLabel>
              <Card>
                <ActionRow
                  title="Live Google Play updates"
                  summary="Check the Play Store for a newer app version."
                  actionText="CHECK"
                  onPress={() => onAction('check-updates')}
                />
                <ActionRow
                  title="Open in Google Play"
                  summary="Open the Play Store listing for this Android app."
                  actionText="PLAY"
                  onPress={() => onAction('check-updates')}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible('page actions reload clear cache') ? (
            <>
              <SectionLabel>PAGE ACTIONS</SectionLabel>
              <Card>
                <ActionRow
                  title="Reload DMZ Ranked"
                  summary="Reload the current website page."
                  actionText="RELOAD"
                  onPress={() => {
                    onAction('reload');
                    onClose();
                  }}
                />
                <ActionRow
                  title="Clear web cache"
                  summary="Clear cached website resources without deleting site storage."
                  actionText="CLEAR"
                  onPress={() => onAction('clear-cache')}
                />
              </Card>
            </>
          ) : null}

          {channel === 'beta' &&
          sectionVisible(
            'beta program discord ticker overlay obs builder test experimental'
          ) ? (
            <>
              <SectionLabel>BETA PROGRAM</SectionLabel>
              <Card>
                <ActionRow
                  title="DMZ Ranked app beta"
                  summary="Open the Harley's Studios app-support Discord."
                  actionText="DISCORD"
                  onPress={() => open(APP_SUPPORT_DISCORD)}
                />
                <ActionRow
                  title="DMZ ticker builder"
                  summary="Open the DMZ ticker builder used by the app's extended links."
                  actionText="OPEN"
                  onPress={() => open(TICKER_BUILDER)}
                />
                <ActionRow
                  title="DMZ themed OBS builder"
                  summary="Open the DMZ themed OBS overlay builder."
                  actionText="OPEN"
                  onPress={() => open(OBS_BUILDER)}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible(
            'help support feedback discord beta group harley studios community'
          ) ? (
            <>
              <SectionLabel>HELP &amp; SUPPORT</SectionLabel>
              <Card>
                <ActionRow
                  title="Feedback"
                  summary="Open Harley's Studios app support to report an issue or suggest an improvement."
                  actionText="FEEDBACK"
                  onPress={() => open(APP_SUPPORT_DISCORD)}
                />
                <ActionRow
                  title="App Support Discord"
                  summary="Get support for the unofficial DMZ Ranked app."
                  actionText="JOIN"
                  onPress={() => open(APP_SUPPORT_DISCORD)}
                />
                <ActionRow
                  title="DMZ Ranked Discord"
                  summary="Open the main DMZ Ranked community Discord."
                  actionText="JOIN"
                  onPress={() => open(MAIN_DISCORD)}
                />
                <ActionRow
                  title="Beta group"
                  summary="Open the DMZ Ranked app beta Google Group."
                  actionText="OPEN"
                  onPress={() => open(BETA_GROUP)}
                />
              </Card>
            </>
          ) : null}

          {channel === 'beta' &&
          sectionVisible('data transfer import production stable beta app settings') ? (
            <>
              <SectionLabel>DATA TRANSFER</SectionLabel>
              <Card>
                <ActionRow
                  title="Import from DMZ Ranked"
                  summary="Import compatible app settings and operator data from the stable app."
                  actionText="IMPORT"
                  onPress={() => onAction('peer-import')}
                />
              </Card>
            </>
          ) : null}

          {sectionVisible('danger clear data cookies storage reset settings') ? (
            <>
              <SectionLabel>DANGER ZONE</SectionLabel>
              <Card>
                <ActionRow
                  title="Clear website data"
                  summary="Clear cache, cookies, and website storage. This can sign you out."
                  actionText="CLEAR DATA"
                  danger
                  onPress={() =>
                    Alert.alert(
                      'Clear website data?',
                      'This clears DMZ Ranked website storage and can sign you out.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear data',
                          style: 'destructive',
                          onPress: () => onAction('clear-data')
                        }
                      ]
                    )
                  }
                />
                <ActionRow
                  title="Reset app settings"
                  summary="Restore app settings to defaults without intentionally deleting website storage."
                  actionText="RESET"
                  danger
                  onPress={() =>
                    Alert.alert(
                      'Reset app settings?',
                      'All DMZ Ranked app settings will return to their defaults.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Reset',
                          style: 'destructive',
                          onPress: onReset
                        }
                      ]
                    )
                  }
                />
              </Card>
            </>
          ) : null}

          {sectionVisible('developer diagnostics runtime copy') ? (
            <>
              <SectionLabel>DEVELOPER &amp; DIAGNOSTICS</SectionLabel>
              <Card>
                <ActionRow
                  title="Copy diagnostic report"
                  summary="Copy non-sensitive app, platform, operator, and setting details for support."
                  actionText="COPY"
                  onPress={() => void copyDiagnostics()}
                />
              </Card>
            </>
          ) : null}

          {q &&
          !sectionVisible(
            'about version build credits harley studios dmz ranked yolando dchinz',
            'appearance content size compact standard large animations motion',
            'widget home screen add refresh rank sr standing',
            'app experience desktop keep awake refresh last page verbose loading',
            'operator backup active verified protected picker save restore sync website',
            'notifications website alerts permission sound vibration test',
            'updates google play live update version store',
            'page actions reload clear cache',
            'beta program discord ticker overlay obs builder test experimental',
            'help support feedback discord beta group harley studios community',
            'data transfer import production stable beta app settings',
            'danger clear data cookies storage reset settings',
            'developer diagnostics runtime copy'
          ) ? (
            <Text style={styles.empty}>No app settings match “{query}”.</Text>
          ) : null}

          <Text style={styles.unofficial}>
            Unofficial client. DMZ Ranked website content and third-party
            trademarks belong to their respective owners.
          </Text>
        </ScrollView>
      </View>
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
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#232725'
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backText: {
    color: colors.white,
    fontSize: 38,
    lineHeight: 38,
    marginTop: -4
  },
  toolbarLogo: { width: 42, height: 42, marginRight: 9 },
  toolbarCopy: { flex: 1 },
  toolbarTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontWeight: '900',
    fontSize: 20
  },
  toolbarSubtitle: {
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 11,
    marginTop: 2
  },
  searchWrap: {
    backgroundColor: colors.black,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8
  },
  search: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#0F1315',
    color: colors.white,
    paddingHorizontal: 14,
    fontSize: 15
  },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 42 },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
    color: colors.gold,
    fontFamily: condensedFont,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8
  },
  card: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: 'hidden'
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2F31'
  },
  rowCopy: { flex: 1, paddingRight: 12 },
  rowTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  rowSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  actionChip: {
    marginLeft: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.goldDark,
    backgroundColor: colors.gold,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  actionText: {
    color: colors.black,
    fontFamily: condensedFont,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5
  },
  dangerChip: {
    backgroundColor: '#3A1717',
    borderColor: colors.red
  },
  dangerText: { color: colors.white },
  aboutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  aboutLogo: { width: 68, height: 68, marginRight: 14 },
  aboutCopy: { flex: 1 },
  aboutTitleRow: { flexDirection: 'row', alignItems: 'center' },
  aboutTitle: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1
  },
  betaBadge: {
    marginLeft: 8,
    color: colors.black,
    backgroundColor: colors.gold,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.goldDark,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: condensedFont,
    fontSize: 10,
    fontWeight: '900'
  },
  aboutMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  creditsButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2F31',
    padding: 13,
    alignItems: 'center'
  },
  creditsButtonText: {
    color: colors.gold,
    fontFamily: condensedFont,
    fontWeight: '900',
    letterSpacing: 1
  },
  credits: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2F31'
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2F31'
  },
  creditLogo: { width: 48, height: 48, marginRight: 12 },
  creditTextBlock: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2F31'
  },
  sizeRow: { padding: 16 },
  sizeChoices: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12
  },
  sizeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 7,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.panelDeep
  },
  sizeButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },
  sizeText: {
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 10,
    fontWeight: '900'
  },
  sizeTextSelected: { color: colors.black },
  operatorBlock: {
    padding: 16
  },
  operatorHeading: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  activeBadge: {
    marginLeft: 8,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    color: colors.black,
    backgroundColor: colors.green,
    fontSize: 9,
    fontWeight: '900'
  },
  operatorStatus: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 36
  },
  unofficial: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 12
  }
});
