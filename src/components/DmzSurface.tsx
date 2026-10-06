import React from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

export function DmzCard({ children }: PropsWithChildren) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={[colors.panel, colors.panelDeep]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.card}
      >
        <View style={styles.cardAccent} />
        {children}
      </LinearGradient>
    </View>
  );
}

export function DmzActionCard({ children }: PropsWithChildren) {
  return (
    <View style={styles.actionShell}>
      <LinearGradient
        colors={[colors.panel, colors.panelDeep]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.action}
      >
        {children}
        <View style={styles.actionAccent} />
      </LinearGradient>
    </View>
  );
}

export function DmzGoldButton({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={[colors.gold, '#F9D16A', colors.goldDark]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.gold}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    overflow: 'hidden'
  },
  card: {
    borderRadius: 9,
    overflow: 'hidden'
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: colors.gold
  },
  actionShell: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    overflow: 'hidden'
  },
  action: {
    borderRadius: 7,
    overflow: 'hidden'
  },
  actionAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.goldDark
  },
  gold: {
    borderRadius: 10,
    overflow: 'hidden'
  }
});
