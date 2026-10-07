import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as Application from 'expo-application';
import { DmzIcon } from './DmzIcon';
import { colors, condensedFont } from '../theme';
import type { AppChannel } from '../types';

type Props = {
  channel: AppChannel;
  online: boolean;
  loading: boolean;
  animations: boolean;
  onOpenSettings: () => void;
};

export function AppHeader({
  channel,
  online,
  loading,
  animations,
  onOpenSettings
}: Props) {
  const version = Application.nativeApplicationVersion ?? '1.0.65';
  const build = Application.nativeBuildVersion ?? '169';
  const messages = useMemo(
    () => [
      `Version ${version} • Build ${build}`,
      "Made by Harley's Studios"
    ],
    [build, version]
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const metaOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animations) {
      metaOpacity.stopAnimation();
      metaOpacity.setValue(1);
    }

    const timer = setInterval(() => {
      let next = Math.floor(Math.random() * messages.length);
      if (messages.length > 1 && next === messageIndex) {
        next = (next + 1) % messages.length;
      }
      if (!animations) {
        setMessageIndex(next);
        return;
      }
      Animated.timing(metaOpacity, {
        toValue: 0.25,
        duration: 130,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (!finished) return;
        setMessageIndex(next);
        Animated.timing(metaOpacity, {
          toValue: 1,
          duration: 190,
          useNativeDriver: true
        }).start();
      });
    }, 4200);

    return () => clearInterval(timer);
  }, [animations, messageIndex, messages.length, metaOpacity]);

  useEffect(() => {
    if (!loading || !animations) {
      titleOpacity.stopAnimation();
      titleOpacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(titleOpacity, {
          toValue: 0.62,
          duration: 520,
          useNativeDriver: true
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animations, loading, titleOpacity]);

  return (
    <View style={styles.header}>
      <Image
        source={require('../../assets/dmz_ranked_logo_display.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
            DMZ Ranked
          </Animated.Text>
          {channel === 'beta' ? <Text style={styles.beta}>BETA</Text> : null}
        </View>
        <Animated.Text
          numberOfLines={1}
          style={[styles.meta, { opacity: metaOpacity }]}
        >
          {messages[messageIndex]}
          {!online ? ' • OFFLINE' : ''}
        </Animated.Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={onOpenSettings}
        android_ripple={{ color: '#333333', borderless: true }}
        style={styles.settingsButton}
      >
        <DmzIcon name="settings" size={28} color={colors.gold} />
      </Pressable>

      <View style={styles.goldLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 74,
    paddingLeft: 10,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.toolbar
  },
  goldLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.gold
  },
  logo: { width: 46, height: 46 },
  titleBlock: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginLeft: 8,
    marginRight: 6
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: Platform.OS === 'android' ? 0.4 : 0
  },
  beta: {
    marginLeft: 7,
    minWidth: 40,
    textAlign: 'center',
    color: colors.black,
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: condensedFont,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 10.5
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
