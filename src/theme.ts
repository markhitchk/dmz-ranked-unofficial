import { Platform } from 'react-native';
import type { ContentSize } from './types';

export const colors = {
  black: '#080A09',
  toolbar: '#111111',
  red: '#E14B4A',
  green: '#55D582',
  gold: '#F6C453',
  goldDark: '#D8A433',
  goldSoft: '#E2B24D',
  white: '#F5F5F5',
  muted: '#999F9B',
  panel: '#14191D',
  panelDeep: '#0B0F11',
  card: '#121619',
  cardBorder: '#343A3B',
  cardBorderGold: '#8A6B24',
  chip: '#101418'
} as const;

export const condensedFont =
  Platform.OS === 'android' ? 'sans-serif-condensed' : undefined;


export function contentScaleFactor(size: ContentSize): number {
  if (size === 'compact') return 0.88;
  if (size === 'large') return 1.12;
  return 1;
}
