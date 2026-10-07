import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isBeta = process.env.APP_VARIANT === 'beta';
  const packageId = isBeta
    ? 'com.harleytg.dmzranked.beta'
    : 'com.harleytg.dmzranked';

  const widgetConfig: WithAndroidWidgetsParams = {
    widgets: [
      {
        name: 'DMZRanked',
        label: isBeta ? 'DMZ Ranked [Beta]' : 'DMZ Ranked',
        description:
          'DMZ Ranked operator rank, SR, standing, and live status.',
        minWidth: '110dp',
        minHeight: '56dp',
        targetCellWidth: 2,
        targetCellHeight: 1,
        resizeMode: 'horizontal|vertical',
        previewImage: './assets/dmz_ranked_logo_display.png',
        updatePeriodMillis: 1800000
      }
    ]
  };

  return {
    ...config,
    name: isBeta ? 'DMZ Ranked [Beta]' : 'DMZ Ranked',
    slug: 'dmz-ranked-unofficial',
    version: '1.0.62',
    orientation: 'default',
    icon: './assets/dmz_launcher_icon.png',
    scheme: 'dmzranked',
    userInterfaceStyle: 'dark',
    androidStatusBar: {
      backgroundColor: '#080A09',
      barStyle: 'light-content',
      hidden: false
    },
    ios: {
      bundleIdentifier: packageId,
      buildNumber: '166',
      supportsTablet: true,
      infoPlist: {
        LSApplicationQueriesSchemes: ['itms-apps']
      }
    },
    android: {
      package: packageId,
      versionCode: 166,
      allowBackup: true,
      adaptiveIcon: {
        foregroundImage: './assets/dmz_launcher_foreground.png',
        backgroundColor: '#080A09'
      },
      permissions: ['POST_NOTIFICATIONS'],
      predictiveBackGestureEnabled: false
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          image: './assets/dmz_ranked_logo_display.png',
          imageWidth: 156,
          resizeMode: 'contain',
          backgroundColor: '#080A09'
        }
      ],
      ['react-native-android-widget', widgetConfig],
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
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0'
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
