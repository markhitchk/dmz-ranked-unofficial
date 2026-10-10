import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { DmzIcon } from './DmzIcon';
import { colors, condensedFont } from '../theme';
import type { AppChannel } from '../types';
import {
  formatCollapsedBrowserUrl,
  normalizeBrowserUrlInput
} from '../services/urlNavigation';

type Props = {
  channel: AppChannel;
  online: boolean;
  loading: boolean;
  animations: boolean;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onNavigate: (url: string) => void;
  onOpenSettings: () => void;
  unreadMessages: number;
  onOpenMessages: () => void;
};

export function AppHeader({
  channel,
  online,
  loading,
  animations,
  currentUrl,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onReload,
  onNavigate,
  onOpenSettings,
  unreadMessages,
  onOpenMessages
}: Props) {
  const version = Application.nativeApplicationVersion ?? '1.1.0';
  const build = Application.nativeBuildVersion ?? '176';
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(currentUrl);

  useEffect(() => {
    if (!editing) setDraftUrl(currentUrl);
  }, [currentUrl, editing]);

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

  const beginEditing = () => {
    setDraftUrl(currentUrl);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftUrl(currentUrl);
    setEditing(false);
    Keyboard.dismiss();
  };

  const submitAddress = () => {
    const normalized = normalizeBrowserUrlInput(draftUrl);
    if (!normalized) {
      cancelEditing();
      return;
    }
    setDraftUrl(normalized);
    setEditing(false);
    Keyboard.dismiss();
    onNavigate(normalized);
  };

  const copyAddress = () => {
    const value = (editing ? draftUrl : currentUrl).trim();
    if (value) void Clipboard.setStringAsync(value);
  };

  const secure = currentUrl.toLowerCase().startsWith('https://');
  const compactUrl = formatCollapsedBrowserUrl(currentUrl);

  return (
    <View style={styles.header}>
      <View style={styles.titleBar}>
        <Image
          source={require('../../assets/dmz_ranked_logo_display.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.titleRow}>
          <Animated.Text
            numberOfLines={1}
            style={[styles.title, { opacity: titleOpacity }]}
          >
            DMZ Ranked
          </Animated.Text>
          {channel === 'beta' ? <Text style={styles.beta}>BETA</Text> : null}
          <Text numberOfLines={1} style={styles.meta}>
            v{version} • {build}{!online ? ' • OFFLINE' : ''}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`App messages${unreadMessages ? `, ${unreadMessages} unread` : ''}`}
          onPress={onOpenMessages}
          style={styles.messagesButton}
        >
          <DmzIcon name="notification" size={21} color={colors.gold} />
          {unreadMessages > 0 ? (
            <View style={styles.messageBadge}>
              <Text style={styles.messageBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={onOpenSettings}
          android_ripple={{ color: '#333333', borderless: true }}
          style={styles.settingsButton}
        >
          <DmzIcon name="settings" size={24} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.browserRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={!canGoBack}
          onPress={onGoBack}
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
        >
          <DmzIcon name="back" size={19} color={colors.white} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Forward"
          disabled={!canGoForward}
          onPress={onGoForward}
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
        >
          <DmzIcon name="forward" size={19} color={colors.white} />
        </Pressable>

        <View style={[styles.addressShell, editing && styles.addressShellEditing]}>
          <DmzIcon
            name={secure ? 'lock' : 'globe'}
            size={14}
            color={secure ? colors.goldSoft : colors.muted}
          />

          {editing ? (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              value={draftUrl}
              onChangeText={setDraftUrl}
              onSubmitEditing={submitAddress}
              onBlur={() => {
                if (editing) cancelEditing();
              }}
              style={styles.addressInput}
              accessibilityLabel="URL"
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit URL"
              onPress={beginEditing}
              onLongPress={copyAddress}
              style={styles.addressPressable}
            >
              <Text numberOfLines={1} style={styles.addressText}>
                {compactUrl || 'dmzranked.com'}
              </Text>
            </Pressable>
          )}

          {editing ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy URL"
                onPress={copyAddress}
                hitSlop={8}
                style={styles.inlineButton}
              >
                <DmzIcon name="copy" size={15} color={colors.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel URL editing"
                onPress={cancelEditing}
                hitSlop={8}
                style={styles.inlineButton}
              >
                <DmzIcon name="close" size={16} color={colors.muted} />
              </Pressable>
            </>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reload"
          onPress={onReload}
          style={styles.navButton}
        >
          <DmzIcon name="reload" size={18} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.goldLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 88,
    backgroundColor: colors.toolbar
  },
  titleBar: {
    height: 46,
    paddingLeft: 9,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: { width: 34, height: 34 },
  titleRow: {
    flex: 1,
    minWidth: 0,
    marginLeft: 7,
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: Platform.OS === 'android' ? 0.35 : 0
  },
  beta: {
    marginLeft: 6,
    textAlign: 'center',
    color: colors.black,
    backgroundColor: colors.gold,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: condensedFont,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7
  },
  meta: {
    marginLeft: 7,
    flexShrink: 1,
    color: colors.muted,
    fontFamily: condensedFont,
    fontSize: 10
  },
  messagesButton: {
    width: 37,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  messageBadge: {
    position: 'absolute',
    right: 0,
    top: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red
  },
  messageBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  browserRow: {
    height: 40,
    paddingHorizontal: 7,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navButtonDisabled: {
    opacity: 0.28
  },
  addressShell: {
    flex: 1,
    height: 32,
    marginHorizontal: 3,
    paddingLeft: 9,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: colors.cardBorderGold,
    borderRadius: 9,
    backgroundColor: colors.panelDeep,
    flexDirection: 'row',
    alignItems: 'center'
  },
  addressShellEditing: {
    borderColor: colors.gold
  },
  addressPressable: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: 7
  },
  addressText: {
    color: colors.white,
    fontSize: 11.5
  },
  addressInput: {
    flex: 1,
    minWidth: 0,
    height: 30,
    marginLeft: 6,
    paddingVertical: 0,
    color: colors.white,
    fontSize: 11.5
  },
  inlineButton: {
    width: 27,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  goldLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.gold
  }
});
