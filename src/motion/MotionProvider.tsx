import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { deriveMotionPolicy, type MotionPolicy } from './motionPolicy';

const MotionContext = createContext<MotionPolicy>({ enabled: false, loopsEnabled: false });

export function MotionProvider({
  enabledByUser,
  children
}: PropsWithChildren<{ enabledByUser: boolean }>): React.JSX.Element {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (live) setReduceMotion(value);
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      setReduceMotion(value);
    });
    const app = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
    });
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);

  const policy = useMemo(
    () => deriveMotionPolicy(enabledByUser, reduceMotion, foreground),
    [enabledByUser, reduceMotion, foreground]
  );
  return <MotionContext.Provider value={policy}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionPolicy {
  return useContext(MotionContext);
}
