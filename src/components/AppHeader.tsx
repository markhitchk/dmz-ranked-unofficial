import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { AppChannel } from '../types';

type Props = {
  channel: AppChannel;
  online: boolean;
  onOpenSettings: () => void;
};

export function AppHeader({ channel, online, onOpenSettings }: Props) {
  return (
    <View style={styles.header}>
      <Image
        source={require('../../assets/dmz_ranked_logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>DMZ Ranked</Text>
          {channel === 'beta' ? <Text style={styles.beta}>BETA</Text> : null}
        </View>
        <Text style={styles.subtitle}>
          Harley&apos;s Studios · {online ? 'Online' : 'Offline'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open app settings"
        onPress={onOpenSettings}
        style={styles.settingsButton}
      >
        <Text style={styles.settingsText}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  logo: { width: 42, height: 42, marginRight: 10 },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  beta: {
    color: '#111',
    backgroundColor: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised
  },
  settingsText: { color: colors.text, fontSize: 22 }
});
