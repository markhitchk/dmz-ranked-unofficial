import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';
import type { AppSettings } from '../types';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  settings: AppSettings;
  channel: 'stable' | 'beta';
  onClose: () => void;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onReset: () => void;
};

function Row({
  title,
  description,
  value,
  onValueChange
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function SettingsPanel({
  visible,
  settings,
  channel,
  onClose,
  onUpdate,
  onReset
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>App Settings</Text>
            <Text style={styles.subtitle}>
              DMZ Ranked · {channel === 'beta' ? 'Beta' : 'Stable'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.section}>Website</Text>
            <Row
              title="App UI overrides"
              description="Load the shared app.css and app.js from GitHub."
              value={settings.appUiOverrides}
              onValueChange={value => onUpdate('appUiOverrides', value)}
            />
            <Row
              title="Pull to refresh"
              description="Allow swipe-to-refresh in the WebView."
              value={settings.pullToRefresh}
              onValueChange={value => onUpdate('pullToRefresh', value)}
            />
            <Row
              title="Remember last page"
              description="Return to the page you were using previously."
              value={settings.rememberLastPage}
              onValueChange={value => onUpdate('rememberLastPage', value)}
            />
            <Row
              title="Desktop site"
              description="Use a desktop browser user agent."
              value={settings.desktopSite}
              onValueChange={value => onUpdate('desktopSite', value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>App</Text>
            <Row
              title="Website notifications"
              description="Allow website events to appear as native notifications."
              value={settings.siteNotifications}
              onValueChange={value => onUpdate('siteNotifications', value)}
            />
            <Row
              title="Verbose loading"
              description="Show additional loading-state information."
              value={settings.verboseLoading}
              onValueChange={value => onUpdate('verboseLoading', value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Operator</Text>
            <Text style={styles.operator}>
              {settings.selectedOperator || 'No operator imported yet'}
            </Text>
            <Text style={styles.operatorState}>
              {settings.operatorVerified
                ? 'Verified on this device'
                : 'Waiting for website import'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Support</Text>
            <Pressable
              style={styles.link}
              onPress={() =>
                void Linking.openURL('https://ko-fi.com/harleytg_#checkoutModal')
              }
            >
              <Text style={styles.linkText}>Support Harley&apos;s Studios</Text>
            </Pressable>
            <Pressable
              style={styles.link}
              onPress={() => void Linking.openURL('https://discord.gg/kdHneTZkyd')}
            >
              <Text style={styles.linkText}>App Support Discord</Text>
            </Pressable>
          </View>

          <Pressable style={styles.reset} onPress={onReset}>
            <Text style={styles.resetText}>Reset app settings</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 12 },
  close: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.gold
  },
  closeText: { color: '#111', fontWeight: '900' },
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden'
  },
  section: {
    color: colors.gold,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  rowCopy: { flex: 1, paddingRight: 12 },
  rowTitle: { color: colors.text, fontWeight: '700' },
  rowDescription: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16
  },
  operator: {
    color: colors.text,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingTop: 4
  },
  operatorState: {
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 3
  },
  link: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  linkText: { color: colors.text, fontWeight: '700' },
  reset: {
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  resetText: { color: '#F08B8B', fontWeight: '800' }
});
