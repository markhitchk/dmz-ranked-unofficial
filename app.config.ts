import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isBeta = process.env.APP_VARIANT === 'beta';
  const packageId = isBeta
    ? 'com.harleytg.dmzranked.beta'
    : 'com.harleytg.dmzranked';

  return {
    ...config,
    name: isBeta ? 'DMZ Ranked [Beta]' : 'DMZ Ranked',
    slug: 'dmz-ranked-unofficial',
    version: '1.1.6',
    orientation: 'default',
    icon: './assets/dmz_launcher_icon.png',
    scheme: 'dmzranked',
    userInterfaceStyle: 'dark',
    androidStatusBar: {
      backgroundColor: '#080A09',
      barStyle: 'light-content',
      hidden: false,
      translucent: true
    },
    ios: {
      bundleIdentifier: packageId,
      buildNumber: '192',
      supportsTablet: true,
      infoPlist: {
        LSApplicationQueriesSchemes: ['itms-apps']
      }
    },
    android: {
      package: packageId,
      versionCode: 192,
      allowBackup: true,
      adaptiveIcon: {
        foregroundImage: './assets/dmz_launcher_foreground.png',
        backgroundColor: '#080A09'
      },
      permissions: ['POST_NOTIFICATIONS'],
      predictiveBackGestureEnabled: false
    },
    plugins: [
      'expo-asset',
      'expo-background-task',
      [
        'expo-splash-screen',
        {
          image: './assets/dmz_ranked_logo_display.png',
          imageWidth: 156,
          resizeMode: 'contain',
          backgroundColor: '#080A09'
        }
      ],
      [
        'expo-notifications',
        {
          icon: './assets/ic_notification_dmz.png',
          color: '#F6C453'
        }
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 37,
            targetSdkVersion: 36,
            // Android 16 release smoke test (build 191) proved that R8
            // breaks WorkManager's generated Room WorkDatabase initializer.
            // Disable release shrinking/obfuscation until the native stack
            // has verified keep rules; otherwise the app crashes before JS.
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false
          },
          ios: {
            deploymentTarget: '16.4'
          }
        }
      ]
    ],
    extra: {
      appChannel: isBeta ? 'beta' : 'stable',
      websiteUrl: 'https://dmzranked.com/'
    }
  };
};
