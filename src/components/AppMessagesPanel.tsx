import React from 'react';
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
import type { AppMessage } from '../services/appMessagesCore';
import { colors, condensedFont } from '../theme';

type Props = {
  visible: boolean;
  messages: AppMessage[];
  readIds: string[];
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
};

export function AppMessagesPanel({
  visible,
  messages,
  readIds,
  refreshing,
  onClose,
  onRefresh,
  onRead,
  onReadAll
}: Props) {
  const insets = useSafeAreaInsets();
  const seen = new Set(readIds);
  const unread = messages.filter(message => !seen.has(message.id)).length;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[
        styles.scrim,
        { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: Math.max(insets.bottom, 18) + 8 }
      ]}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>HARLEY'S STUDIOS • DMZ RANKED</Text>
              <Text style={styles.heading}>APP MESSAGES</Text>
              <Text style={styles.summary}>{unread} unread • {messages.length} total</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close messages" style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onRefresh} disabled={refreshing} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionText}>{refreshing ? 'CHECKING…' : '↻ REFRESH'}</Text>
            </Pressable>
            <Pressable
              onPress={onReadAll}
              disabled={unread === 0}
              style={[styles.action, unread === 0 && styles.disabled]}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>MARK ALL READ</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {messages.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHeading}>ALL CAUGHT UP</Text>
                <Text style={styles.body}>No active messages from Harley's Studios. Check again later.</Text>
              </View>
            ) : messages.map(message => {
              const isRead = seen.has(message.id);
              return (
                <View
                  key={message.id}
                  style={[styles.messageCard, message.priority === 'important' && styles.important]}
                >
                  <View style={styles.messageTop}>
                    <Text style={[
                      styles.priority,
                      message.priority === 'important' && styles.importantText,
                      message.priority === 'warning' && styles.warningText
                    ]}>
                      {message.priority.toUpperCase()}
                    </Text>
                    {!isRead ? <Text style={styles.unread}>● NEW</Text> : <Text style={styles.read}>READ</Text>}
                  </View>
                  <Text style={styles.title}>{message.title}</Text>
                  <Text style={styles.body}>{message.body}</Text>
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
                    {!isRead ? (
                      <Pressable onPress={() => onRead(message.id)} style={styles.messageAction}>
                        <Text style={styles.messageActionText}>MARK READ</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <Text style={styles.footer}>Messages are checked while the app is open. This is not a background push service.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', paddingHorizontal: 13, backgroundColor: 'rgba(0,0,0,0.86)' },
  panel: { maxHeight: '94%', borderRadius: 14, overflow: 'hidden', borderColor: colors.cardBorderGold, borderWidth: 1, backgroundColor: colors.panelDeep },
  header: { flexDirection: 'row', padding: 16, backgroundColor: colors.toolbar, borderBottomWidth: 2, borderBottomColor: colors.gold },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700', color: colors.goldSoft },
  heading: { fontFamily: condensedFont, fontSize: 26, letterSpacing: 1.6, color: colors.white, fontWeight: '900', marginTop: 3 },
  summary: { color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.gold, fontSize: 24 },
  actions: { flexDirection: 'row', padding: 10, gap: 10 },
  action: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 9, borderColor: colors.cardBorderGold, borderWidth: 1, flex: 1, alignItems: 'center' },
  actionText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.3 },
  scroll: { flexGrow: 0 },
  content: { padding: 11, paddingBottom: 18 },
  emptyCard: { padding: 24, alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderColor: colors.cardBorder, borderWidth: 1 },
  emptyHeading: { fontFamily: condensedFont, color: colors.gold, fontWeight: '900', fontSize: 18 },
  body: { color: colors.white, fontSize: 13, marginTop: 8, lineHeight: 20 },
  messageCard: { padding: 14, marginBottom: 11, borderWidth: 1, borderRadius: 11, borderColor: colors.cardBorder, backgroundColor: colors.card },
  important: { borderColor: colors.red },
  messageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  priority: { color: colors.gold, fontSize: 11, fontWeight: '900' },
  importantText: { color: colors.red },
  warningText: { color: colors.goldDark },
  unread: { fontSize: 11, fontWeight: '800', color: colors.gold },
  read: { fontSize: 11, color: colors.muted },
  title: { fontFamily: condensedFont, fontSize: 20, fontWeight: '900', color: colors.white, marginTop: 7 },
  messageActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  messageAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, borderColor: colors.cardBorderGold, borderWidth: 1 },
  messageActionText: { fontSize: 11, fontWeight: '800', color: colors.gold },
  footer: { color: colors.muted, textAlign: 'center', paddingHorizontal: 10, paddingBottom: 13, fontSize: 10 }
});
