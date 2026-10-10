export function settingsEntryState(visible: boolean, enabled: boolean): {
  opacity: number;
  searchOffsetY: number;
  contentOffsetY: number;
} {
  return visible && enabled
    ? { opacity: 0, searchOffsetY: -10, contentOffsetY: 18 }
    : { opacity: 1, searchOffsetY: 0, contentOffsetY: 0 };
}

export function shouldStartSettingsEntry(
  previousVisible: boolean,
  nextVisible: boolean,
  enabled: boolean
): boolean {
  return !previousVisible && nextVisible && enabled;
}
