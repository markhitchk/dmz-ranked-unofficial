import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isBeta = process.env.APP_VARIANT === 'beta';
  const packageId = isBeta ? 'com.harleytg.dmzranked.beta' : 'com.harleytg.dmzranked';

  return {
    ...config,
    name: isBeta ? 'DMZ Ranked [Beta]' : 'DMZ Ranked',
    slug: 'dmz-ranked-unofficial',
    version: '1.0.61',
    orientation: 'portrait',
    icon: './assets/dmz_ranked_logo.png',
    scheme: 'dmzranked',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    ios: { bundleIdentifier: packageId, buildNumber: '165', supportsTablet: true },
    android: {
      package: packageId,
      versionCode: 165,
      adaptiveIcon: {
        foregroundImage: './assets/dmz_ranked_logo.png',
        backgroundColor: '#111111'
      },
      permissions: ['POST_NOTIFICATIONS'],
      predictiveBackGestureEnabled: true
    },
    plugins: [
      ['expo-notifications', {
        icon: './assets/ic_notification_dmz.png',
        color: '#D6A84B'
      }],
      ['expo-build-properties', {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0'
        },
        ios: { deploymentTarget: '16.4' }
      }]
    ],
    extra: {
      appChannel: isBeta ? 'beta' : 'stable',
      websiteUrl: 'https://dmzranked.com/'
    }
  };
};
