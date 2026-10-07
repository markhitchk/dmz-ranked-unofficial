import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const CHANNEL_ID = 'dmz_site_alerts_v3_heads_up';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH
  })
});

export async function initializeNotifications(enabled: boolean): Promise<void> {
  if (!enabled) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'DMZ Ranked pop-up alerts',
      description:
        'Heads-up reports, reviews, approvals, system, update, website, season, and test alerts.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 90, 220],
      lightColor: '#F6C453',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

function normalizeAlert(title: string, body: string): {
  line: string;
  body: string;
} {
  let line = title.trim() || '[System] Alert';
  let text = body.trim();

  if (/^\[RAID\]/i.test(line)) {
    line = '[Raids] Raid submitted';
  } else if (/^\[REPORTS?\]/i.test(line)) {
    line = /operator/i.test(`${title} ${body}`)
      ? '[Reports] Operator reported'
      : '[Reports] Raid reported';
  } else if (/^\[APPROVED\]/i.test(line)) {
    line = '[Approved] Raid approved';
  } else if (/^\[REVIEW\]/i.test(line)) {
    line = '[Review] Raid under review';
  } else if (/^\[UPDATE\]/i.test(line)) {
    line = '[System] Update available';
  } else if (/^\[SEASON\]/i.test(line)) {
    line = '[System] Season update';
  } else if (/^\[WEBSITE\]/i.test(line)) {
    line = '[System] Website alert';
  }

  if (text.length > 320) text = text.slice(0, 319) + '…';
  return { line, body: text };
}

export async function showWebsiteNotification(
  title: string,
  body: string
): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;

  const normalized = normalizeAlert(title, body);
  const alertLine = normalized.line;
  const alertBody = normalized.body;
  const preview = alertBody ? `${alertLine} • ${alertBody}` : alertLine;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DMZ Ranked',
      body: preview,
      sound: 'default',
      color: '#F6C453',
      autoDismiss: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { source: 'dmzranked.com', alertTitle: alertLine }
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null
  });
}
