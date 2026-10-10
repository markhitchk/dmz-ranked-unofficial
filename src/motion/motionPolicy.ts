export type MotionPolicy = { enabled: boolean; loopsEnabled: boolean };

export const MOTION = {
  pressInMs: 90,
  pressedScale: 0.97,
  settingsSearchMs: 180,
  settingsContentMs: 240,
  settingsContentDelayMs: 45,
  dialogOpenMs: 190,
  dialogCloseMs: 150,
  loadingFadeMs: 180,
  logoPulseLegMs: 620,
  titlePulseLegMs: 520,
  metadataIntervalMs: 4200,
  metadataFadeOutMs: 130,
  metadataFadeInMs: 190
} as const;

export function deriveMotionPolicy(
  preferenceEnabled: boolean,
  reducedMotion: boolean,
  appForeground: boolean
): MotionPolicy {
  const enabled = preferenceEnabled && !reducedMotion;
  return { enabled, loopsEnabled: enabled && appForeground };
}

export function pressScaleTarget(
  pressed: boolean,
  disabled: boolean,
  policyEnabled: boolean
): number {
  return pressed && !disabled && policyEnabled ? MOTION.pressedScale : 1;
}
