import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import type { PressableProps } from 'react-native';
import { useMotion } from './MotionProvider';
import { MOTION, pressScaleTarget } from './motionPolicy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type MotionPressableProps = PressableProps & {
  pressedScale?: number;
};

export function MotionPressable({
  pressedScale = MOTION.pressedScale,
  disabled = false,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: MotionPressableProps): React.JSX.Element {
  const { enabled } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled || disabled) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => {
      scale.stopAnimation();
    };
  }, [enabled, disabled, scale]);

  const change = (pressed: boolean) => {
    const target = pressed && enabled && !disabled ? pressedScale
      : pressScaleTarget(false, Boolean(disabled), enabled);
    scale.stopAnimation();
    if (!enabled || disabled) {
      scale.setValue(1);
    } else if (pressed) {
      Animated.timing(scale, {
        toValue: target, duration: MOTION.pressInMs, useNativeDriver: true
      }).start();
    } else {
      Animated.spring(scale, {
        toValue: 1, speed: 25, bounciness: 5, useNativeDriver: true
      }).start();
    }
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        { transform: [{ scale }] }
      ]}
      onPressIn={event => { change(true); onPressIn?.(event); }}
      onPressOut={event => { change(false); onPressOut?.(event); }}
    >
      {children}
    </AnimatedPressable>
  );
}
