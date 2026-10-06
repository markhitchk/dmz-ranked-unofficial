import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function LoadingOverlay({ verbose }: { verbose: boolean }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.title}>Loading DMZ Ranked</Text>
        {verbose ? (
          <Text style={styles.detail}>
            Connecting to dmzranked.com and applying the app UI…
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  card: {
    width: '78%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14
  },
  detail: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17
  }
});
