export function nextHeaderMetaIndex(previous: number, count: number): number {
  if (count <= 1) return 0;
  return previous < 0 ? 0 : (previous + 1) % count;
}
