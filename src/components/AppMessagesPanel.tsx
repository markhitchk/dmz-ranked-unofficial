import React, { useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NotificationCenterItem, NoticeCategory } from '../services/notificationCenterCore';
import { DmzIcon } from './DmzIcon';
import { colors, condensedFont } from '../theme';

type Filter = 'all' | 'system' | 'reports' | 'updates' | 'developer';
type Props = {
  visible: boolean;
  messages: NotificationCenterItem[];
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'system', label: 'SYSTEM' },
  { id: 'reports', label: 'REPORTS' },
  { id: 'updates', label: 'UPDATES' },
  { id: 'developer', label: 'MESSAGES' }
];
function filterMatches(filter: Filter, category: NoticeCategory): boolean {
  return filter === 'all' || filter === category ||
    (filter === 'system' && category === 'website');
}
function categoryLabel(category: NoticeCategory): string {
  if (category === 'developer') return "HARLEY'S STUDIOS";
  if (category === 'reports') return 'REPORTS & RAIDS';
  if (category === 'updates') return 'UPDATES';
  return category === 'website' ? 'WEBSITE' : 'SYSTEM';
}
function displayDate(value: number): string {
  if (value <= 0) return 'DEVELOPER MESSAGE';
  return new Date(value).toLocaleString();
}

export function AppMessagesPanel({
  visible,
  messages,
  refreshing,
  onClose,
  onRefresh,
  onRead,
  onReadAll
}: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const unread = messages.filter(item => !item.isRead).length;
  const selected = messages.filter(item => filterMatches(filter, item.category));

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.scrim, {
        paddingTop: Math.max(insets.top, 20) + 8,
        paddingBottom: Math.max(insets.bottom, 18) + 8
      }]}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.bellCircle}>
              <DmzIcon name="bell" size={25} color={colors.gold} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>DMZ RANKED • ACTIVITY</Text>
              <Text style={styles.heading}>NOTIFICATION CENTER</Text>
              <Text style={styles.summary}>{unread} unread • {messages.length} notifications</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}
            contentContainerStyle={styles.tabsContent}>
            {FILTERS.map(tab => {
              const count = messages.filter(item =>
                !item.isRead && filterMatches(tab.id, item.category)).length;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === tab.id }}
                  onPress={() => setFilter(tab.id)}
                  style={[styles.tab, filter === tab.id && styles.tabSelected]}
                >
                  <Text style={[styles.tabLabel, filter === tab.id && styles.tabLabelSelected]}>
                    {tab.label}{count ? ` · ${count}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onRefresh} disabled={refreshing} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>{refreshing ? 'CHECKING…' : '↻ REFRESH'}</Text>
            </Pressable>
            <Pressable onPress={onReadAll} disabled={!unread}
              style={[styles.action, !unread && styles.disabled]} accessibilityRole="button">
              <Text style={styles.actionText}>MARK ALL READ</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {selected.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHeading}>ALL CAUGHT UP 🔔</Text>
                <Text style={styles.body}>No {filter === 'all' ? 'notifications' : filter.toLowerCase() + ' alerts'} to display.</Text>
              </View>
            ) : selected.map(message => (
              <View key={message.id}
                style={[styles.messageCard, !message.isRead && styles.unreadCard,
                  message.priority === 'important' && styles.important]}>
                <View style={styles.messageTop}>
                  <Text style={[styles.priority,
                    message.priority === 'important' && styles.importantText]}>
                    {categoryLabel(message.category)} • {message.priority.toUpperCase()}
                  </Text>
                  <Text style={message.isRead ? styles.read : styles.unread}>
                    {message.isRead ? 'READ' : '● NEW'}
                  </Text>
                </View>
                <Text style={styles.title}>{message.title}</Text>
                <Text style={styles.body}>{message.body}</Text>
                <Text style={styles.date}>{displayDate(message.receivedAt)}</Text>
                <View style={styles.messageActions}>
                  {message.link ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => {
                        onRead(message.id);
                        void Linking.openURL(message.link!).catch(() => undefined);
                      }}
                      style={styles.messageAction}
                    >
                      <Text style={styles.messageActionText}>{message.linkLabel ?? 'OPEN LINK'} ↗</Text>
                    </Pressable>
                  ) : null}
                  {!message.isRead ? (
                    <Pressable onPress={() => onRead(message.id)} style={styles.messageAction}
                      accessibilityRole="button">
                      <Text style={styles.messageActionText}>MARK READ ✓</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.footer}>Website alerts and system activity are saved here even if Android notification permission is denied. Developer messages refresh while the app is active.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.88)' },
  panel: { maxHeight: '95%', borderRadius: 14, overflow: 'hidden', borderColor: colors.cardBorderGold, borderWidth: 1, backgroundColor: colors.panelDeep },
  header: { flexDirection: 'row', padding: 13, backgroundColor: colors.toolbar, borderBottomWidth: 2, borderBottomColor: colors.gold, alignItems: 'center' },
  bellCircle: { width: 37, height: 37, borderRadius: 20, marginRight: 9, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: '700', color: colors.goldSoft },
  heading: { fontFamily: condensedFont, fontSize: 21, letterSpacing: 0.9, color: colors.white, fontWeight: '900', marginTop: 2 },
  summary: { color: colors.muted, fontSize: 11, marginTop: 3 },
  close: { height: 40, width: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.gold, fontSize: 22 },
  tabs: { flexGrow: 0, backgroundColor: colors.toolbar, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  tabsContent: { paddingHorizontal: 9, paddingVertical: 8, gap: 6 },
  tab: { paddingVertical: 7, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.cardBorder },
  tabSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabLabel: { color: colors.muted, fontWeight: '800', fontSize: 10 },
  tabLabelSelected: { color: colors.black },
  actions: { flexDirection: 'row', padding: 10, gap: 10 },
  action: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 9, borderColor: colors.cardBorderGold, borderWidth: 1, flex: 1, alignItems: 'center' },
  actionText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.3 },
  scroll: { flexGrow: 0 },
  content: { padding: 11, paddingBottom: 18 },
  emptyCard: { padding: 24, alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderColor: colors.cardBorder, borderWidth: 1 },
  emptyHeading: { fontFamily: condensedFont, color: colors.gold, fontWeight: '900', fontSize: 18 },
  body: { color: colors.white, fontSize: 13, marginTop: 8, lineHeight: 20 },
  messageCard: { padding: 13, marginBottom: 10, borderWidth: 1, borderRadius: 11, borderColor: colors.cardBorder, backgroundColor: colors.card },
  unreadCard: { borderColor: colors.cardBorderGold },
  important: { borderColor: colors.red },
  messageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  priority: { flex: 1, color: colors.gold, fontSize: 10, fontWeight: '900' },
  importantText: { color: colors.red },
  unread: { fontSize: 11, fontWeight: '800', color: colors.gold },
  read: { fontSize: 11, color: colors.muted },
  title: { fontFamily: condensedFont, fontSize: 19, fontWeight: '900', color: colors.white, marginTop: 7 },
  date: { color: colors.muted, fontSize: 10, marginTop: 7 },
  messageActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  messageAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, borderColor: colors.cardBorderGold, borderWidth: 1 },
  messageActionText: { fontSize: 11, fontWeight: '800', color: colors.gold },
  footer: { color: colors.muted, textAlign: 'center', paddingHorizontal: 10, paddingBottom: 13, fontSize: 10 }
});
