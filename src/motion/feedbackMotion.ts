import type { MotionPolicy } from './motionPolicy';
export function feedbackEntryEnabled(visible: boolean, policy: MotionPolicy): boolean {
  return visible && policy.enabled;
}
