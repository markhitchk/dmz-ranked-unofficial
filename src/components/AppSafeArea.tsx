import React, { type PropsWithChildren } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { colors } from '../theme';

type AppSafeAreaProps = PropsWithChildren<{
  initialWindow?: boolean;
  contentScale?: number;
}>;

function SafeAreaFrame({
  children,
  contentScale = 1
}: PropsWithChildren<{ contentScale?: number }>) {
  const measuredInsets = useSafeAreaInsets();
  const initialInsets = initialWindowMetrics?.insets;

  // Android 15/16 can report a zero top inset briefly for translucent modal
  // windows. Keep the system notification/status tray outside app content by
  // falling back to the native status-bar height until insets settle.
  const topInset =
    Platform.OS === 'android'
      ? Math.max(
          measuredInsets.top,
          initialInsets?.top ?? 0,
          StatusBar.currentHeight ?? 0
        )
      : Math.max(measuredInsets.top, initialInsets?.top ?? 0);
  const rightInset = Math.max(
    measuredInsets.right,
    initialInsets?.right ?? 0
  );
  const bottomInset = Math.max(
    measuredInsets.bottom,
    initialInsets?.bottom ?? 0
  );
  const leftInset = Math.max(measuredInsets.left, initialInsets?.left ?? 0);

  const scale = Math.max(0.75, Math.min(1.25, contentScale));
  const inverse = 100 / scale;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: topInset,
          paddingRight: rightInset,
          paddingBottom: bottomInset,
          paddingLeft: leftInset
        }
      ]}
    >
      <View style={styles.viewport}>
        <View
          style={[
            styles.scaledFrame,
            {
              width: `${inverse}%`,
              height: `${inverse}%`,
              transform: [{ scale }],
              transformOrigin: [0, 0, 0]
            }
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

// Keep this wrapper shared by the permanent app root and full-screen modals.
// Supplying initial metrics avoids the one-frame zero-inset state that caused
// the title bar/logo to render underneath Samsung's Android status tray.
export function AppSafeArea({
  children,
  initialWindow: _initialWindow = false,
  contentScale = 1
}: AppSafeAreaProps) {
  return (
    <SafeAreaProvider
      style={styles.provider}
      initialMetrics={initialWindowMetrics}
    >
      <StatusBar
        hidden={false}
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaFrame contentScale={contentScale}>
        {children}
      </SafeAreaFrame>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: { flex: 1, backgroundColor: colors.black },
  root: { flex: 1, backgroundColor: colors.black },
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.black
  },
  scaledFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.black
  }
});
