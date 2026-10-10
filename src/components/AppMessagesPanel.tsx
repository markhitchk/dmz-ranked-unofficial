import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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

type Filter = 'all' | 'system' | 'reports' | 'updates' | 'developer' | 'history';
type Props = {
  visible: boolean;
  messages: NotificationCenterItem[];
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'system', label: 'SYSTEM' },
  { id: 'reports', label: 'REPORTS' },
  { id: 'updates', label: 'UPDATES' },
  { id: 'developer', label: 'MESSAGES' },
  { id: 'history', label: 'HISTORY' }
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
  onReadAll,
  onDelete,
  onDeleteMany
}: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const listRef = useRef<ScrollView>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded(current => ({ ...current, [id]: !current[id] }));
  };
  useEffect(() => {
    if (visible) {
      listRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [visible]);

  const unread = messages.filter(item => !item.isRead).length;
  const selected = messages.filter(item => filter === 'history'
    ? item.isRead
    : filterMatches(filter, item.category));

  const confirmDelete = (ids: string[], label: string) => {
    if (!ids.length) return;
    Alert.alert(
      label,
      `Delete ${ids.length} notification${ids.length === 1 ? '' : 's'} from this device? This cannot be undone.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: () => onDeleteMany(ids) }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
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
              <Text
                style={styles.heading}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                NOTIFICATION CENTER
              </Text>
              <Text style={styles.summary}>{unread} unread • {messages.length} notifications</Text>
            </View>
            <Pressable
              onPress={() => confirmDelete(messages.map(message => message.id), 'Clear notifications')}
              disabled={!messages.length}
              accessibilityRole="button"
              accessibilityLabel="Delete all notifications"
              style={styles.deleteAllButton}
            >
              <DmzIcon name="trash" size={18} color={messages.length ? colors.red : colors.muted} />
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabs}
            contentContainerStyle={styles.tabsContent}
            keyboardShouldPersistTaps="handled"
          >
            {FILTERS.map(tab => {
              const count = messages.filter(item =>
                tab.id === 'history' ? item.isRead : !item.isRead && filterMatches(tab.id, item.category)
              ).length;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === tab.id }}
                  onPress={() => {
                    setFilter(tab.id);
                    listRef.current?.scrollTo({ y: 0, animated: false });
                  }}
                  style={[styles.tab, filter === tab.id && styles.tabSelected]}
                >
                  <Text
                    style={[styles.tabLabel, filter === tab.id && styles.tabLabelSelected]}
                    maxFontSizeMultiplier={1.25}
                    numberOfLines={1}
                  >
                    {tab.label}{count ? ` · ${count}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Refresh notifications"
            >
              <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>
                {refreshing ? 'CHECKING…' : '↻ REFRESH'}
              </Text>
            </Pressable>
            {filter === 'history' ? (
              <Pressable
                onPress={() => confirmDelete(selected.map(item => item.id), 'Clear notification history')}
                disabled={!selected.length}
                style={[styles.action, !selected.length && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Clear notification history"
              >
                <Text style={[styles.actionText, styles.deleteText]} maxFontSizeMultiplier={1.3}>
                  CLEAR HISTORY
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onReadAll}
                disabled={!unread}
                style={[styles.action, !unread && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications read"
              >
                <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>✓ MARK ALL READ</Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            ref={listRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {selected.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHeading}>ALL CAUGHT UP 🔔</Text>
                <Text style={styles.body}>
                  {filter === 'history'
                    ? 'Previously read notifications will appear here, including older developer announcements.'
                    : 'No notifications in this category.'}
                </Text>
              </View>
            ) : selected.map(message => (
              <View key={message.id}
                style={[styles.messageCard, !message.isRead && styles.unreadCard,
                  message.priority === 'important' && styles.important]}>
                <View style={styles.messageTop}>
                  <Text
                    numberOfLines={1}
                    style={[styles.priority, message.priority === 'important' && styles.importantText]}
                  >
                    {categoryLabel(message.category)} · {message.priority.toUpperCase()}
                  </Text>
                  <Text style={message.isRead ? styles.read : styles.unread}>
                    {message.isRead ? 'READ' : '● NEW'}
                  </Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>{message.title}</Text>
                <Text
                  style={styles.body}
                  numberOfLines={expanded[message.id] ? undefined : 3}
                >
                  {message.body}
                </Text>
                <Text style={styles.date}>{displayDate(message.receivedAt)}</Text>
                <View style={styles.messageActions}>
                  {message.body.length > 110 ? (
                    <Pressable
                      onPress={() => toggleExpanded(message.id)}
                      style={styles.textAction}
                      accessibilityRole="button"
                      accessibilityLabel={expanded[message.id] ? 'Show less notification text' : 'Read full notification'}
                    >
                      <Text style={styles.textActionLabel}>
                        {expanded[message.id] ? 'SHOW LESS' : 'READ MORE'}
                      </Text>
                    </Pressable>
                  ) : null}
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
                  <Pressable
                    onPress={() => onDelete(message.id)}
                    style={[styles.messageAction, styles.deleteAction]}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete notification: ${message.title}`}
                  >
                    <DmzIcon name="trash" size={14} color={colors.red} />
                    <Text style={[styles.messageActionText, styles.deleteText]}>DELETE</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.footer}>
            Recent alerts are kept on this device. Use History for read notifications, or Delete to remove them.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.87)'
  },
  // Give the list a real, bounded height. With maxHeight alone, Android
  // measured all cards first and compressed the horizontal category tabs
  // until the lettering was cut in half on smaller phones.
  panel: {
    height: '94%',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 15,
    overflow: 'hidden',
    borderColor: colors.cardBorderGold,
    borderWidth: 1,
    backgroundColor: colors.panelDeep
  },
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.toolbar,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
    alignItems: 'center'
  },
  bellCircle: {
    width: 36, height: 36, borderRadius: 18, marginRight: 8,
    backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center'
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, letterSpacing: 1.1, fontWeight: '700', color: colors.goldSoft },
  heading: {
    fontFamily: condensedFont, fontSize: 19, letterSpacing: 0.5,
    color: colors.white, fontWeight: '900', marginTop: 3
  },
  summary: { color: colors.muted, fontSize: 11, marginTop: 4 },
  deleteAllButton: {
    flexShrink: 0, height: 44, width: 34,
    alignItems: 'center', justifyContent: 'center'
  },
  close: {
    flexShrink: 0, height: 44, width: 36,
    alignItems: 'center', justifyContent: 'center'
  },
  closeText: { color: colors.gold, fontSize: 24 },
  // Crucial: reserve a fixed row for tabs so the adjacent vertical
  // ScrollView never squeezes their text on high-font-scale Android devices.
  tabs: {
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.toolbar,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  tabsContent: {
    minHeight: 47,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 7
  },
  tab: {
    height: 34,
    minWidth: 61,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabLabel: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  tabLabelSelected: { color: colors.black },
  actions: {
    flexShrink: 0, flexDirection: 'row',
    paddingHorizontal: 11, paddingVertical: 10, gap: 9
  },
  action: {
    minHeight: 42, paddingHorizontal: 8, borderRadius: 9,
    borderColor: colors.cardBorderGold, borderWidth: 1,
    flex: 1, alignItems: 'center', justifyContent: 'center'
  },
  actionText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 16 },
  emptyCard: {
    padding: 22, alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 10, borderColor: colors.cardBorder, borderWidth: 1
  },
  emptyHeading: {
    fontFamily: condensedFont, color: colors.gold,
    fontWeight: '900', fontSize: 17
  },
  body: { color: colors.white, fontSize: 13, marginTop: 8, lineHeight: 20 },
  messageCard: {
    padding: 13, marginBottom: 10, borderWidth: 1, borderRadius: 10,
    borderColor: colors.cardBorder, backgroundColor: colors.card
  },
  unreadCard: { borderColor: colors.cardBorderGold },
  important: { borderColor: colors.red },
  messageTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  priority: { flex: 1, minWidth: 0, color: colors.gold, fontSize: 10, fontWeight: '900' },
  importantText: { color: colors.red },
  unread: { fontSize: 10, fontWeight: '800', color: colors.gold },
  read: { fontSize: 10, color: colors.muted },
  title: {
    fontFamily: condensedFont, fontSize: 17,
    fontWeight: '900', color: colors.white, marginTop: 8
  },
  date: { color: colors.muted, fontSize: 10, marginTop: 9 },
  messageActions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 11
  },
  messageAction: {
    minHeight: 33, paddingHorizontal: 10, borderRadius: 7,
    borderColor: colors.cardBorderGold, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  messageActionText: { fontSize: 11, fontWeight: '800', color: colors.gold },
  deleteAction: {
    flexDirection: 'row', gap: 5, borderColor: colors.cardBorder,
  },
  deleteText: { color: colors.red },
  textAction: {
    minHeight: 33, paddingHorizontal: 9,
    marginRight: 'auto', justifyContent: 'center'
  },
  textActionLabel: { color: colors.goldSoft, fontSize: 11, fontWeight: '800' },
  footer: {
    flexShrink: 0, color: colors.muted, textAlign: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.cardBorder, fontSize: 10
  }
});
