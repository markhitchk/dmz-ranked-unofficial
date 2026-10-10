import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export type DmzIconName =
  | 'back'
  | 'bell'
  | 'close'
  | 'copy'
  | 'database'
  | 'forward'
  | 'globe'
  | 'lock'
  | 'notification'
  | 'reload'
  | 'search'
  | 'settings'
  | 'sync';

export const DmzIcon = React.memo(function DmzIcon({
  name,
  size = 24,
  color
}: {
  name: DmzIconName;
  size?: number;
  color?: string;
}) {
  const fill = color ?? (name === 'settings' || name === 'database' ? colors.gold : colors.white);

  if (name === 'back') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z" />
      </Svg>
    );
  }

  if (name === 'forward') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="m12 4-1.42 1.41L16.17 11H4v2h12.17l-5.59 5.59L12 20l8-8z" />
      </Svg>
    );
  }

  if (name === 'reload') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z" />
      </Svg>
    );
  }

  if (name === 'lock') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4zm7 13H7v-9h10z" />
      </Svg>
    );
  }

  if (name === 'close') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3z" />
      </Svg>
    );
  }

  if (name === 'copy') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z" />
      </Svg>
    );
  }

  if (name === 'database') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={fill}
          d="M12 2C7.58 2 4 3.79 4 6s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zM4 9v4c0 2.21 3.58 4 8 4s8-1.79 8-4V9c-1.72 1.58-4.68 2.5-8 2.5S5.72 10.58 4 9zM4 16v2c0 2.21 3.58 4 8 4s8-1.79 8-4v-2c-1.72 1.58-4.68 2.5-8 2.5S5.72 17.58 4 16z"
        />
      </Svg>
    );
  }

  if (name === 'globe') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill="none" stroke={fill} strokeWidth={1.8} d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" />
        <Path
          fill="none"
          stroke={fill}
          strokeWidth={1.6}
          d="M2.5 9h19M2.5 15h19M12 2c3 3 4 6.2 4 10s-1 7-4 10M12 2c-3 3-4 6.2-4 10s1 7 4 10"
        />
      </Svg>
    );
  }

  if (name === 'sync') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={fill}
          d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-3.73 0-6.84 2.55-7.73 6H1l4.5 4.5L10 10H6.35C7.17 7.67 9.39 6 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3zM18.5 9.5 14 14h3.65c-.82 2.33-3.04 4-5.65 4-1.66 0-3.14-.69-4.22-1.78L11 13H3v8l3.35-3.35C7.8 19.1 9.79 20 12 20c3.73 0 6.84-2.55 7.73-6H23z"
        />
      </Svg>
    );
  }

  if (name === 'settings') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={fill}
          d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.5 2.42C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42L9.13 5.07c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.66-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
        />
      </Svg>
    );
  }

  if (name === 'bell') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={fill} d="M12 22a2.02 2.02 0 0 0 2-2h-4a2.02 2.02 0 0 0 2 2zm6-6V10a6 6 0 0 0-5-5.91V3a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 10v6l-2 2v1h16v-1l-2-2zm-10 1.17V10a4 4 0 0 1 8 0v7.17l.83.83H7.17L8 17.17z" />
      </Svg>
    );
  }

  if (name === 'notification') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={fill}
          fillRule="evenodd"
          d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M12 4.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 1 1 0-15.6"
        />
        <Path fill={fill} d="M10.9 7.2h2.2v7l-1.1 2.2-1.1-2.2z" />
        <Path fill={fill} d="m6.9 11.6 1.5-1.5 3.6 3.6-1.5 1.5zM17.1 11.6l-1.5-1.5-3.6 3.6 1.5 1.5z" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={fill}
        d="M9.5 3a6.5 6.5 0 1 0 3.95 11.66L19.79 21 21 19.79l-6.34-6.34A6.5 6.5 0 0 0 9.5 3zm0 2A4.5 4.5 0 1 1 5 9.5 4.5 4.5 0 0 1 9.5 5z"
      />
    </Svg>
  );
});
