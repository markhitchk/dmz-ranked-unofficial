import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, condensedFont } from '../theme';
import type { AppChannel } from '../types';

type Props = {
  channel: AppChannel;
  progress: number;
  status: string;
  verbose: boolean;
  animations: boolean;
};

export function LoadingOverlay({
  channel,
  progress,
  status,
  verbose,
  animations
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const version = Application.nativeApplicationVersion ?? '1.0.63';
  const build = Application.nativeBuildVersion ?? '167';

  useEffect(() => {
    if (!animations) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 620,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animations, pulse]);

  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <LinearGradient
      colors={['#0B0F0C', '#101513', colors.black]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.overlay}
      pointerEvents="none"
    >
      <View style={styles.center}>
        <Animated.View
          style={{
            transform: [{ scale: pulse }],
            opacity: pulse.interpolate({
              inputRange: [1, 1.06],
              outputRange: [1, 0.78]
            })
          }}
        >
          <Image
            source={require('../../assets/dmz_ranked_logo_display.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>DMZ Ranked</Text>
          {channel === 'beta' ? <Text style={styles.beta}>BETA</Text> : null}
        </View>

        <Text style={styles.version}>
          Version {version} • Build {build}
        </Text>

        <View style={styles.track}>
          <LinearGradient
            colors={[colors.goldDark, colors.gold]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { width: `${safeProgress}%` }]}
          />
        </View>

        {verbose ? <Text style={styles.verbose}>{status}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  logo: { width: 156, height: 156 },
  nameRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  name: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: Platform.OS === 'android' ? 1.2 : 0
  },
  beta: {
    marginLeft: 9,
    minWidth: 44,
    textAlign: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    color: colors.black,
    fontFamily: condensedFont,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  version: {
    marginTop: 8,
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 13,
    letterSpacing: 0.3
  },
  track: {
    width: 240,
    height: 4,
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#1D2325'
  },
  fill: {
    height: 4,
    borderRadius: 3
  },
  verbose: {
    marginTop: 10,
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 13,
    textAlign: 'center'
  }
});
