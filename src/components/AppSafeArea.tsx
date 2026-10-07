import React, { type PropsWithChildren } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
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
  initialWindow = false
}: PropsWithChildren<{ initialWindow?: boolean }>) {
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
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black }
});
