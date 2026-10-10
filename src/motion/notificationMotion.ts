export function notificationTabScale(selected: boolean, enabled: boolean): number {
  return !enabled || selected ? 1 : 0.985;
}
