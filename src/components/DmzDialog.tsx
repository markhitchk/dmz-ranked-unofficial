import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, condensedFont } from '../theme';
import { useMotion } from '../motion/MotionProvider';
import { MotionPressable } from '../motion/MotionPressable';
import { MOTION } from '../motion/motionPolicy';
import { nextDialogPhase, type DialogPhase } from '../motion/dialogTransition';

export type DmzDialogChoice = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  eyebrow?: string;
  title: string;
  message?: string;
  danger?: boolean;
  positiveLabel?: string;
  negativeLabel?: string;
  input?: {
    value: string;
    placeholder: string;
    secure?: boolean;
    numeric?: boolean;
    maxLength?: number;
    error?: string;
    onChange: (value: string) => void;
  };
  choices?: DmzDialogChoice[];
  operatorPicker?: boolean;
  animations?: boolean;
  contentScale?: number;
  onPositive?: () => void;
  onNegative?: () => void;
};

function Tape({ danger, label }: { danger: boolean; label: string }) {
  const stripeCount = 18;
  return (
    <View
      style={[
        styles.tape,
        { backgroundColor: danger ? colors.red : colors.gold }
      ]}
    >
      {Array.from({ length: stripeCount }, (_, index) => (
        <View
          key={index}
          style={[
            styles.tapeStripe,
            {
              left: index * 28 - 40
            }
          ]}
        />
      ))}
      <Text style={styles.tapeLabel}>{label}</Text>
    </View>
  );
}

export function DmzDialog({
  visible,
  eyebrow = 'DMZ RANKED',
  title,
  message,
  danger = false,
  positiveLabel = 'OK',
  negativeLabel,
  input,
  choices,
  operatorPicker = false,
  animations = true,
  contentScale = 1,
  onPositive,
  onNegative
}: Props) {
  const animation = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { enabled: motionEnabled } = useMotion();
  const animate = animations && motionEnabled;
  const [mounted, setMounted] = useState(visible);
  const phase = useRef<DialogPhase>(visible ? 'entering' : 'hidden');
  const revision = useRef(0);
  const actionAccepted = useRef(false);
  const wasVisible = useRef(false);

  // Validation dialogs stay visible after a rejected submission.
  // Re-arm the action when a PIN/value or validation error changes.
  useEffect(() => {
    if (visible && input) actionAccepted.current = false;
  }, [visible, input?.value, input?.error]);

  const negative = () => {
    if (actionAccepted.current) return;
    actionAccepted.current = true;
    onNegative?.();
  };
  const positive = () => {
    if (actionAccepted.current) return;
    actionAccepted.current = true;
    onPositive?.();
  };

  useEffect(() => {
    const token = ++revision.current;
    animation.stopAnimation();
    if (visible) {
      if (!wasVisible.current) actionAccepted.current = false;
      wasVisible.current = true;
      phase.current = nextDialogPhase(phase.current, 'open');
      setMounted(true);
      if (!animate) {
        animation.setValue(1);
        phase.current = nextDialogPhase(phase.current, 'entered');
      } else {
        animation.setValue(0);
        Animated.timing(animation, {
          toValue: 1, duration: MOTION.dialogOpenMs, useNativeDriver: true
        }).start(({ finished }) => {
          if (finished && revision.current === token) {
            phase.current = nextDialogPhase(phase.current, 'entered');
          }
        });
      }
    } else {
      wasVisible.current = false;
      phase.current = nextDialogPhase(phase.current, 'close');
      if (!animate || phase.current === 'hidden') {
        animation.setValue(0);
        setMounted(false);
        phase.current = 'hidden';
      } else {
        Animated.timing(animation, {
          toValue: 0, duration: MOTION.dialogCloseMs, useNativeDriver: true
        }).start(({ finished }) => {
          if (finished && revision.current === token) {
            phase.current = nextDialogPhase(phase.current, 'exited');
            setMounted(false);
          }
        });
      }
    }
    return () => {
      ++revision.current;
      animation.stopAnimation();
    };
  }, [animation, animate, visible]);

  if (!mounted && !visible) return null;

  const densityScale = Math.max(0.75, Math.min(1.25, contentScale));
  const inverseDensity = 100 / densityScale;
  const borderColor = danger ? colors.red : colors.cardBorderGold;
  const gradient = danger
    ? ['#1A1718', colors.card, colors.panelDeep]
    : ['#171C20', colors.card, colors.panelDeep];

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={negative}
    >
      <Pressable
        style={[
          styles.scrim,
          {
            paddingTop:
              Platform.OS === 'android'
                ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
                : insets.top,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left
          }
        ]}
        onPress={negative}
      >
        <View
          style={[
            styles.densityFrame,
            {
              width: `${inverseDensity}%`,
              transform: [{ scale: densityScale }]
            }
          ]}
        >
          <Animated.View
            style={[
              styles.cardShell,
              {
                borderColor,
                borderWidth: danger ? 2 : 1,
                opacity: animation,
                transform: [
                  {
                    translateY: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0]
                    })
                  },
                  {
                    scale: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1]
                    })
                  }
                ]
              }
            ]}
          >
          <Pressable onPress={() => undefined}>
            <LinearGradient
              colors={gradient as [string, string, string]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.card}
            >
              {danger ? (
                <Tape danger label="⚠  DANGER ZONE  •  CAUTION" />
              ) : operatorPicker ? (
                <Tape danger={false} label="OPERATOR PICKER  •  DMZ RANKED" />
              ) : null}

              <Text
                style={[
                  styles.eyebrow,
                  { color: danger ? colors.red : colors.gold },
                  (danger || operatorPicker) && styles.afterTape
                ]}
              >
                {danger
                  ? 'DESTRUCTIVE ACTION'
                  : operatorPicker
                    ? 'PROFILE SELECTION'
                    : eyebrow}
              </Text>

              <Text style={styles.heading}>{title}</Text>

              {message ? <Text style={styles.message}>{message}</Text> : null}

              {danger ? (
                <View style={styles.warningPanel}>
                  <View style={styles.warningIcon}>
                    <Text style={styles.warningIconText}>!</Text>
                  </View>
                  <View style={styles.warningCopy}>
                    <Text style={styles.warningTitle}>REVIEW THIS ACTION</Text>
                    <Text style={styles.warningText}>
                      This can remove or reset data and may not be recoverable.
                    </Text>
                  </View>
                </View>
              ) : null}

              {input ? (
                <View style={styles.inputWrap}>
                  <TextInput
                    value={input.value}
                    onChangeText={input.onChange}
                    placeholder={input.placeholder}
                    placeholderTextColor={colors.muted}
                    secureTextEntry={input.secure}
                    keyboardType={input.numeric ? 'number-pad' : 'default'}
                    maxLength={input.maxLength}
                    autoFocus
                    style={styles.input}
                  />
                  {input.error ? (
                    <Text style={styles.inputError}>{input.error}</Text>
                  ) : null}
                </View>
              ) : null}

              {choices?.length ? (
                <View style={styles.choices}>
                  {choices.map((choice, index) => (
                    <MotionPressable
                      key={choice.label + index}
                      onPress={choice.onPress}
                      style={[
                        styles.choice,
                        choice.selected && styles.choiceSelected,
                        index > 0 && styles.choiceGap
                      ]}
                    >
                      <View
                        style={[
                          styles.choiceSelector,
                          choice.selected && styles.choiceSelectorSelected
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceCheck,
                            choice.selected && styles.choiceCheckSelected
                          ]}
                        >
                          {choice.selected ? '✓' : ''}
                        </Text>
                      </View>
                      <View style={styles.choiceCopy}>
                        <Text
                          style={[
                            styles.choiceName,
                            choice.selected && styles.choiceNameSelected
                          ]}
                        >
                          {choice.label}
                        </Text>
                        <Text style={styles.choiceState}>
                          {choice.selected
                            ? 'Current operator'
                            : 'Tap to use this operator'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.choiceChip,
                          choice.selected && styles.choiceChipSelected
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            choice.selected && styles.choiceChipTextSelected
                          ]}
                        >
                          {choice.selected ? 'ACTIVE' : 'SELECT'}
                        </Text>
                      </View>
                    </MotionPressable>
                  ))}
                  {operatorPicker ? (
                    <Text style={styles.choiceFooter}>
                      Profiles are imported from DMZRanked.com  •  Maximum 2 operators
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {operatorPicker && choices?.length ? (
                negativeLabel ? (
                  <MotionPressable style={styles.fullCancel} onPress={negative}>
                    <Text style={styles.cancelText}>{negativeLabel}</Text>
                  </MotionPressable>
                ) : null
              ) : (
                <View style={styles.actions}>
                  {negativeLabel ? (
                    <MotionPressable
                      style={[
                        styles.action,
                        styles.secondaryAction,
                        danger && styles.secondaryDanger
                      ]}
                      onPress={negative}
                    >
                      <Text
                        style={[
                          styles.secondaryText,
                          danger && styles.secondaryDangerText
                        ]}
                      >
                        {negativeLabel}
                      </Text>
                    </MotionPressable>
                  ) : null}

                  <MotionPressable
                    style={[
                      styles.action,
                      negativeLabel ? styles.actionGap : null,
                      danger ? styles.dangerAction : styles.primaryAction
                    ]}
                    onPress={positive}
                  >
                    <Text
                      style={
                        danger ? styles.primaryDangerText : styles.primaryText
                      }
                    >
                      {positiveLabel}
                    </Text>
                  </MotionPressable>
                </View>
              )}
            </LinearGradient>
          </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  densityFrame: {
    alignItems: 'center',
    paddingHorizontal: 14
  },
  cardShell: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 18
  },
  card: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16
  },
  tape: {
    height: 36,
    marginHorizontal: -18,
    marginTop: -18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tapeStripe: {
    position: 'absolute',
    top: -35,
    width: 12,
    height: 110,
    backgroundColor: 'rgba(8,10,9,0.36)',
    transform: [{ rotate: '-24deg' }]
  },
  tapeLabel: {
    color: colors.white,
    backgroundColor: 'rgba(8,10,9,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.6
  },
  afterTape: { marginTop: 14 },
  heading: {
    marginTop: 7,
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 21,
    fontWeight: '900'
  },
  message: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19
  },
  warningPanel: {
    marginTop: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelDeep,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12
  },
  warningIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center'
  },
  warningIconText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  warningCopy: { flex: 1, marginLeft: 11 },
  warningTitle: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9
  },
  warningText: { marginTop: 3, color: colors.muted, fontSize: 12.5, lineHeight: 17 },
  inputWrap: { marginTop: 14 },
  input: {
    color: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15
  },
  inputError: { color: colors.red, fontSize: 11, marginTop: 5 },
  choices: { marginTop: 15 },
  choice: {
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.panelDeep,
    flexDirection: 'row',
    alignItems: 'center'
  },
  choiceSelected: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.panel
  },
  choiceGap: { marginTop: 9 },
  choiceSelector: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.muted,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center'
  },
  choiceSelectorSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },
  choiceCheck: { color: colors.muted, fontSize: 15, fontWeight: '900' },
  choiceCheckSelected: { color: colors.black },
  choiceCopy: { flex: 1, marginLeft: 12 },
  choiceName: { color: colors.white, fontSize: 15 },
  choiceNameSelected: { color: colors.gold, fontWeight: '900' },
  choiceState: { marginTop: 2, color: colors.muted, fontSize: 11.5 },
  choiceChip: {
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldDark,
    backgroundColor: colors.panelDeep
  },
  choiceChipSelected: { backgroundColor: colors.gold },
  choiceChipText: { color: colors.gold, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  choiceChipTextSelected: { color: colors.black },
  choiceFooter: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 10.5,
    textAlign: 'center'
  },
  actions: { marginTop: 18, flexDirection: 'row' },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12
  },
  actionGap: { marginLeft: 10 },
  primaryAction: { backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.gold },
  dangerAction: { backgroundColor: colors.red, borderWidth: 1, borderColor: colors.red },
  secondaryAction: {
    backgroundColor: colors.panelDeep,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  secondaryDanger: { borderColor: colors.red },
  primaryText: { color: colors.black, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  primaryDangerText: { color: colors.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  secondaryText: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  secondaryDangerText: { color: colors.white },
  fullCancel: {
    marginTop: 15,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.panelDeep,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelText: { color: colors.muted, fontSize: 11, fontWeight: '900' }
});
