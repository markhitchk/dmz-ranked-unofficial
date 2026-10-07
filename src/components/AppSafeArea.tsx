import React, { type PropsWithChildren } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView
} from 'react-native-safe-area-context';
import { colors } from '../theme';

// Each full-screen Modal has its own native window and must measure its own
// insets. Only the app's permanent root uses the initial window metrics.
export function AppSafeArea({
  children,
  initialWindow = false,
  contentScale = 1
}: PropsWithChildren<{ initialWindow?: boolean; contentScale?: number }>) {
  const scale = Math.max(0.75, Math.min(1.25, contentScale));
  const inverse = 100 / scale;
  return (
    <SafeAreaProvider
      style={styles.root}
      initialMetrics={initialWindow ? initialWindowMetrics : undefined}
    >
      <StatusBar hidden={false} barStyle="light-content" />
      <SafeAreaView
        style={styles.root}
        edges={['top', 'right', 'bottom', 'left']}
      >
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  scaledFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.black
  }
});
