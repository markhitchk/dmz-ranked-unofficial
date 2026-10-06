import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'dmz_site_alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function initializeNotifications(enabled: boolean): Promise<void> {
  if (!enabled) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'DMZ Ranked site alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: '#D6A84B'
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

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { source: 'dmzranked.com' }
    },
    trigger: null
  });
}
