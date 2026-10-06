import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const CHANNEL_ID = 'dmz_site_alerts_v3_heads_up';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
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

export async function showWebsiteNotification(
  title: string,
  body: string
): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return;

  const alertLine = title.trim() || '[System] Alert';
  const alertBody = body.trim();
  const preview = alertBody ? `${alertLine} • ${alertBody}` : alertLine;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DMZ Ranked',
      body: preview,
      sound: 'default',
      color: '#F6C453',
      data: { source: 'dmzranked.com', alertTitle: alertLine }
    },
    trigger: null
  });
}
