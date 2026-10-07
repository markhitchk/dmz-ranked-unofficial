'use no memo';
import React from 'react';
import {
  FlexWidget,
  ImageWidget,
  TextWidget
} from 'react-native-android-widget';
import type { WidgetStats } from '../services/widgetStats';
import { tierColor } from '../services/widgetStats';

const GOLD = '#F6C453';
const GOLD_DARK = '#8A6B24';
const WHITE = '#F5F5F5';
const MUTED = '#999F9B';
const GREEN = '#55D582';
const RED = '#E14B4A';
const PANEL = '#F20B0F11';
const CHIP = '#101418';
const BORDER = '#343A3B';

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function signed(value: number): string {
  if (value > 0) return `+${value} SR`;
  return `${value} SR`;
}

function timeLabel(value: number): string {
  try {
    return new Date(value)
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toUpperCase();
  } catch {
    return 'NOW';
  }
}

function Progress({
  width,
  pct,
  height
}: {
  width: number;
  pct: number;
  height: number;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <FlexWidget
      style={{
        width,
        height,
        borderRadius: Math.max(1, height / 2),
        backgroundColor: BORDER
      }}
    >
      <FlexWidget
        style={{
          width: Math.max(1, (width * safe) / 100),
          height,
          borderRadius: Math.max(1, height / 2),
          backgroundColor: GOLD
        }}
      />
    </FlexWidget>
  );
}

export function DmzRankedWidget({
  width,
  height,
  stats,
  beta,
  operator = '',
  loading = false
}: {
  width: number;
  height: number;
  stats: WidgetStats | null;
  beta: boolean;
  operator?: string;
  loading?: boolean;
}) {
  const operatorName = operator.trim();
  const stateLabel = loading
    ? 'SYNCING'
    : stats
      ? stats.fromCache
        ? 'CACHED'
        : 'LIVE'
      : operatorName
        ? 'OFFLINE'
        : 'NO OPERATOR';
  const emptyRank = operatorName
    ? 'Could not reach DMZ Ranked.'
    : 'Open DMZ Ranked → Operators';
  const compact = width < 245 || height < 125;
  const large = width >= 330 && height >= 165;

  if (compact) {
    return (
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'column',
          backgroundColor: PANEL,
          borderWidth: 1,
          borderColor: GOLD_DARK,
          borderRadius: 18,
          padding: 5
        }}
      >
        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <ImageWidget
            image={stats?.badgeData || require('../../assets/dmz_ranked_logo_display.png')}
            imageWidth={38}
            imageHeight={40}
          />

          <FlexWidget
            style={{
              flex: 1,
              marginLeft: 6,
              flexDirection: 'column'
            }}
          >
            <FlexWidget
              style={{
                width: 'match_parent',
                flexDirection: 'row',
                alignItems: 'center'
              }}
            >
              <ImageWidget
                image={require('../../assets/dmz_ranked_logo_display.png')}
                imageWidth={14}
                imageHeight={14}
              />
              <TextWidget
                text="DMZ RANKED"
                style={{
                  color: WHITE,
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginLeft: 4
                }}
              />
              {beta ? (
                <TextWidget
                  text="[BETA]"
                  style={{
                    color: '#080A09',
                    backgroundColor: GOLD,
                    fontSize: 6,
                    fontWeight: 'bold',
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 4,
                    marginLeft: 4
                  }}
                />
              ) : null}
              <TextWidget
                text={stateLabel}
                style={{
                  color: GOLD,
                  backgroundColor: CHIP,
                  fontSize: 6,
                  fontWeight: 'bold',
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  borderRadius: 4,
                  marginLeft: 4
                }}
              />
            </FlexWidget>

            <TextWidget
              text={stats?.name || operatorName || 'SELECT AN OPERATOR'}
              truncate="END"
              maxLines={1}
              style={{
                color: WHITE,
                fontSize: 13,
                fontWeight: 'bold'
              }}
            />
            <TextWidget
              text={
                loading
                  ? 'Refreshing live standings…'
                  : stats?.rankLabel || emptyRank
              }
              truncate="END"
              maxLines={1}
              style={{
                color: stats ? tierColor(stats.rankLabel) : GOLD,
                fontSize: 7,
                fontWeight: 'bold'
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              width: 54,
              marginLeft: 5,
              flexDirection: 'column',
              alignItems: 'flex-end'
            }}
          >
            <TextWidget
              text={stats ? `${formatNumber(stats.sr)} SR` : '— SR'}
              style={{ color: WHITE, fontSize: 13, fontWeight: 'bold' }}
            />
            <TextWidget
              text={
                stats
                  ? `#${stats.position} / ${Math.max(stats.totalPlayers, stats.position)}`
                  : '#— / —'
              }
              style={{ color: WHITE, fontSize: 7, fontWeight: 'bold' }}
            />
            <TextWidget
              text={stats ? signed(stats.lastDelta) : 'NO DATA'}
              style={{
                color:
                  !stats || stats.lastDelta === 0
                    ? MUTED
                    : stats.lastDelta > 0
                      ? GREEN
                      : RED,
                fontSize: 7,
                fontWeight: 'bold'
              }}
            />
          </FlexWidget>

          <FlexWidget
            clickAction="refresh"
            accessibilityLabel="Refresh DMZ Ranked widget"
            style={{
              width: 26,
              height: 26,
              marginLeft: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: CHIP,
              borderColor: BORDER,
              borderWidth: 1,
              borderRadius: 10
            }}
          >
            <TextWidget
              text="↻"
              style={{ color: WHITE, fontSize: 16, fontWeight: 'bold' }}
            />
          </FlexWidget>
        </FlexWidget>

        {stats ? (
          <FlexWidget style={{ marginTop: 1 }}>
            <Progress
              width={Math.max(30, width - 10)}
              pct={stats.progressPct}
              height={2}
            />
          </FlexWidget>
        ) : null}

        <FlexWidget
          style={{
            width: 'match_parent',
            marginTop: 1,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <TextWidget
            text="MADE BY HARLEY'S STUDIOS"
            truncate="END"
            maxLines={1}
            style={{
              color: MUTED,
              fontSize: 5,
              fontWeight: 'bold',
              flex: 1
            }}
          />
          <TextWidget
            text={
              stats
                ? `${stats.fromCache ? 'CACHED • ' : ''}UPDATED ${timeLabel(stats.updatedAt)}`
                : 'READING LIVE DATA'
            }
            style={{ color: MUTED, fontSize: 5, marginLeft: 4 }}
          />
          <TextWidget
            text={stats?.seasonName?.toUpperCase() || 'DMZRANKED.COM'}
            truncate="END"
            maxLines={1}
            style={{
              color: GOLD,
              fontSize: 5,
              fontWeight: 'bold',
              marginLeft: 4
            }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }

  if (large) {
    const usableWidth = Math.max(100, width - 118);
    return (
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'column',
          backgroundColor: PANEL,
          borderWidth: 1,
          borderColor: GOLD_DARK,
          borderRadius: 18,
          padding: 14
        }}
      >
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <ImageWidget
            image={require('../../assets/dmz_ranked_logo_display.png')}
            imageWidth={34}
            imageHeight={34}
          />
          <FlexWidget
            style={{ flex: 1, marginLeft: 10, flexDirection: 'column' }}
          >
            <TextWidget
              text="DMZ RANKED"
              style={{ color: WHITE, fontSize: 15, fontWeight: 'bold' }}
            />
            <TextWidget
              text="MADE BY HARLEY'S STUDIOS"
              style={{ color: MUTED, fontSize: 9, fontWeight: 'bold' }}
            />
          </FlexWidget>

          {beta ? (
            <TextWidget
              text="[BETA]"
              style={{
                color: '#080A09',
                backgroundColor: GOLD,
                fontSize: 9,
                fontWeight: 'bold',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                marginRight: 7
              }}
            />
          ) : null}

          <TextWidget
            text={stateLabel}
            style={{
              color: GOLD,
              backgroundColor: CHIP,
              borderColor: GOLD_DARK,
              borderWidth: 1,
              borderRadius: 99,
              paddingHorizontal: 8,
              paddingVertical: 4,
              fontSize: 9,
              fontWeight: 'bold',
              marginRight: 7
            }}
          />

          <FlexWidget
            clickAction="refresh"
            accessibilityLabel="Refresh DMZ Ranked widget"
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: CHIP,
              borderColor: BORDER,
              borderWidth: 1,
              borderRadius: 10
            }}
          >
            <TextWidget
              text="↻"
              style={{ color: WHITE, fontSize: 22, fontWeight: 'bold' }}
            />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            marginTop: 9,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <ImageWidget
            image={stats?.badgeData || require('../../assets/dmz_ranked_logo_display.png')}
            imageWidth={76}
            imageHeight={84}
          />

          <FlexWidget
            style={{
              flex: 1,
              marginLeft: 14,
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <TextWidget
              text={stats?.name || operatorName || 'SELECT AN OPERATOR'}
              truncate="END"
              maxLines={1}
              style={{ color: WHITE, fontSize: 22, fontWeight: 'bold' }}
            />
            <TextWidget
              text={loading ? 'Loading live standings…' : stats?.rankLabel || emptyRank}
              truncate="END"
              maxLines={1}
              style={{
                color: stats ? tierColor(stats.rankLabel) : GOLD,
                fontSize: 13,
                fontWeight: 'bold'
              }}
            />

            <FlexWidget
              style={{
                width: 'match_parent',
                marginTop: 7,
                flexDirection: 'row',
                alignItems: 'center'
              }}
            >
              <TextWidget
                text={stats ? `${formatNumber(stats.sr)} SR` : '… SR'}
                style={{ color: WHITE, fontSize: 26, fontWeight: 'bold', width: Math.max(70, usableWidth * 0.42) }}
              />
              <TextWidget
                text={
                  stats
                    ? `#${stats.position} / ${Math.max(stats.totalPlayers, stats.position)}`
                    : '#… / …'
                }
                style={{
                  color: WHITE,
                  fontSize: 14,
                  fontWeight: 'bold',
                  width: Math.max(55, usableWidth * 0.28),
                  textAlign: 'center'
                }}
              />
              <TextWidget
                text={stats ? signed(stats.lastDelta) : '+0 SR'}
                style={{
                  color:
                    !stats || stats.lastDelta === 0
                      ? MUTED
                      : stats.lastDelta > 0
                        ? GREEN
                        : RED,
                  fontSize: 13,
                  fontWeight: 'bold',
                  width: Math.max(55, usableWidth * 0.30),
                  textAlign: 'right'
                }}
              />
            </FlexWidget>

            <FlexWidget style={{ marginTop: 7 }}>
              <Progress
                width={usableWidth}
                pct={stats?.progressPct ?? 0}
                height={5}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          style={{
            width: 'match_parent',
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <TextWidget
            text={
              stats
                ? `${stats.fromCache ? 'CACHED • ' : ''}UPDATED ${timeLabel(stats.updatedAt)}`
                : loading
                  ? 'READING LIVE DATA'
                  : operatorName
                    ? 'REFRESH WHEN ONLINE'
                    : 'TAP TO OPEN APP'
            }
            truncate="END"
            maxLines={1}
            style={{ color: MUTED, fontSize: 9, width: Math.max(100, width - 150) }}
          />
          <TextWidget
            text={stats?.seasonName?.toUpperCase() || 'SEASON'}
            truncate="END"
            maxLines={1}
            style={{ color: GOLD, fontSize: 9, fontWeight: 'bold', marginLeft: 10 }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: PANEL,
        borderWidth: 1,
        borderColor: GOLD_DARK,
        borderRadius: 18,
        padding: 10
      }}
    >
      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}
      >
        <ImageWidget
          image={require('../../assets/dmz_ranked_logo_display.png')}
          imageWidth={26}
          imageHeight={26}
        />
        <FlexWidget style={{ flex: 1, marginLeft: 8, flexDirection: 'column' }}>
          <TextWidget
            text="DMZ RANKED"
            style={{ color: WHITE, fontSize: 13, fontWeight: 'bold' }}
          />
          <TextWidget
            text="MADE BY HARLEY'S STUDIOS"
            style={{ color: MUTED, fontSize: 7, fontWeight: 'bold' }}
          />
        </FlexWidget>

        {beta ? (
          <TextWidget
            text="[BETA]"
            style={{
              color: '#080A09',
              backgroundColor: GOLD,
              fontSize: 7,
              fontWeight: 'bold',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 5,
              marginRight: 6
            }}
          />
        ) : null}

        <TextWidget
          text={stateLabel}
          style={{
            color: GOLD,
            backgroundColor: CHIP,
            borderColor: GOLD_DARK,
            borderWidth: 1,
            borderRadius: 99,
            paddingHorizontal: 7,
            paddingVertical: 3,
            fontSize: 7,
            fontWeight: 'bold',
            marginRight: 6
          }}
        />

        <FlexWidget
          clickAction="refresh"
          accessibilityLabel="Refresh DMZ Ranked widget"
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: CHIP,
            borderColor: BORDER,
            borderWidth: 1,
            borderRadius: 10
          }}
        >
          <TextWidget text="↻" style={{ color: WHITE, fontSize: 18, fontWeight: 'bold' }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          marginTop: 7,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <ImageWidget
          image={stats?.badgeData || require('../../assets/dmz_ranked_logo_display.png')}
          imageWidth={58}
          imageHeight={64}
        />
        <FlexWidget style={{ flex: 1, marginLeft: 10, flexDirection: 'column' }}>
          <TextWidget
            text={stats?.name || operatorName || 'SELECT AN OPERATOR'}
            truncate="END"
            maxLines={1}
            style={{ color: WHITE, fontSize: 17, fontWeight: 'bold' }}
          />
          <TextWidget
            text={loading ? 'Loading live standings…' : stats?.rankLabel || emptyRank}
            truncate="END"
            maxLines={1}
            style={{
              color: stats ? tierColor(stats.rankLabel) : GOLD,
              fontSize: 10,
              fontWeight: 'bold'
            }}
          />
          <FlexWidget
            style={{
              width: 'match_parent',
              marginTop: 5,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <TextWidget
              text={stats ? `${formatNumber(stats.sr)} SR` : '… SR'}
              style={{ color: WHITE, fontSize: 19, fontWeight: 'bold', width: Math.max(55, width - 130) }}
            />
            <TextWidget
              text={
                stats
                  ? `#${stats.position} / ${Math.max(stats.totalPlayers, stats.position)}`
                  : '#… / …'
              }
              style={{ color: WHITE, fontSize: 9, fontWeight: 'bold', marginRight: 8 }}
            />
            <TextWidget
              text={stats ? signed(stats.lastDelta) : '+0 SR'}
              style={{
                color:
                  !stats || stats.lastDelta === 0
                    ? MUTED
                    : stats.lastDelta > 0
                      ? GREEN
                      : RED,
                fontSize: 9,
                fontWeight: 'bold'
              }}
            />
          </FlexWidget>
          <FlexWidget style={{ marginTop: 5 }}>
            <Progress
              width={Math.max(60, width - 96)}
              pct={stats?.progressPct ?? 0}
              height={3}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          marginTop: 4,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <TextWidget
          text={stats ? `UPDATED ${timeLabel(stats.updatedAt)}` : 'DMZRANKED.COM • LIVE DATA'}
          truncate="END"
          maxLines={1}
          style={{ color: MUTED, fontSize: 7, width: Math.max(80, width - 120) }}
        />
        <TextWidget
          text={stats?.seasonName?.toUpperCase() || 'SEASON'}
          truncate="END"
          maxLines={1}
          style={{ color: GOLD, fontSize: 7, fontWeight: 'bold', marginLeft: 6 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
