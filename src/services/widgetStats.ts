import AsyncStorage from '@react-native-async-storage/async-storage';

const PUBLIC_STATE_URL = 'https://dmzranked.com/api/v1/data/public-state';
const SNAPSHOT_DATA_URL = 'https://dmzranked.com/leaderboard.json';
const CACHE_PREFIX = 'dmz_widget_cache_v1:';

type Tier = { name: string; min: number; fee: number };
const TIERS: Tier[] = [
  { name: 'Iridescent', min: 6000, fee: 100 },
  { name: 'Crimson', min: 5000, fee: 75 },
  { name: 'Diamond', min: 4000, fee: 60 },
  { name: 'Platinum', min: 3000, fee: 45 },
  { name: 'Gold', min: 2000, fee: 30 },
  { name: 'Silver', min: 1000, fee: 15 },
  { name: 'Bronze', min: 0, fee: 0 }
];

type Standing = {
  id: string;
  name: string;
  achievementLevels: Record<string, number>;
  sr: number;
  peak: number;
  last: number;
  raids: number;
  operatorKills: number;
  squadKills: number;
  exfils: number;
  weaponCases: number;
  finalExfils: number;
  contracts: number;
  bossKills: number;
};

type Raid = {
  ts: number;
  playerId: string;
  playerName: string;
  operatorKills: number;
  squadKills: number;
  bossKills: number;
  extracted: boolean;
  finalExfil: boolean;
  fullSquad: boolean;
  weaponCase: boolean;
  contract: string;
  hasCarryover: boolean;
  carryover: number;
};

export type WidgetStats = {
  name: string;
  sr: number;
  peak: number;
  lastDelta: number;
  position: number;
  totalPlayers: number;
  rankLabel: string;
  progressPct: number;
  srToNext: number;
  seasonName: string;
  updatedAt: number;
  fromCache: boolean;
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function raidFrom(obj: any): Raid {
  const hasCarryover =
    Object.prototype.hasOwnProperty.call(obj ?? {}, 'carryover') &&
    obj?.carryover != null;
  return {
    ts: Number(obj?.ts) || 0,
    playerId: clean(obj?.playerId),
    playerName: clean(obj?.playerName),
    operatorKills: Number(obj?.operatorKills) || 0,
    squadKills: Number(obj?.squadKills) || 0,
    bossKills: Number(obj?.bossKills) || 0,
    extracted: Boolean(obj?.extracted),
    finalExfil: Boolean(obj?.finalExfil),
    fullSquad: Boolean(obj?.fullSquad),
    weaponCase: Boolean(obj?.weaponCase),
    contract: clean(obj?.contract || 'none').toLowerCase(),
    hasCarryover,
    carryover: hasCarryover ? Number(obj?.carryover) || 0 : 0
  };
}

function newStanding(id: string, name: string): Standing {
  return {
    id,
    name,
    achievementLevels: {},
    sr: 0,
    peak: 0,
    last: 0,
    raids: 0,
    operatorKills: 0,
    squadKills: 0,
    exfils: 0,
    weaponCases: 0,
    finalExfils: 0,
    contracts: 0,
    bossKills: 0
  };
}

function rankInfo(inputSr: number) {
  const sr = Math.max(0, inputSr);
  let tierIndex = TIERS.length - 1;
  for (let i = 0; i < TIERS.length; i += 1) {
    if (sr >= TIERS[i]!.min) {
      tierIndex = i;
      break;
    }
  }

  const tier = TIERS[tierIndex]!;
  if (tierIndex === 0) {
    return {
      tier: tier.name,
      apex: true,
      division: 0,
      label: tier.name,
      progressPct: 100,
      toNext: 0
    };
  }

  const upper = TIERS[tierIndex - 1]!.min;
  const span = upper - tier.min;
  const divWidth = span / 3;
  const d = Math.max(0, Math.min(2, Math.floor((sr - tier.min) / divWidth)));
  const roman = ['I', 'II', 'III'][d]!;
  const floor = tier.min + d * divWidth;
  const next = tier.min + (d + 1) * divWidth;

  return {
    tier: tier.name,
    apex: false,
    division: d + 1,
    label: `${tier.name} ${roman}`,
    progressPct: Math.round(
      Math.max(0, Math.min(100, ((sr - floor) / Math.max(1, next - floor)) * 100))
    ),
    toNext: Math.max(0, Math.ceil(next - sr))
  };
}

function tierFor(sr: number): Tier {
  return TIERS.find(tier => sr >= tier.min) ?? TIERS[TIERS.length - 1]!;
}

function feeFor(sr: number): number {
  const info = rankInfo(sr);
  const tier = tierFor(sr);
  return info.apex ? tier.fee : tier.fee + (info.division - 1) * 5;
}

function awardAchievement(
  standing: Standing,
  key: string,
  value: number,
  thresholds: number[]
): number {
  const achieved = thresholds.filter(threshold => value >= threshold).length;
  const previous = standing.achievementLevels[key] ?? 0;
  if (achieved <= previous || previous >= 4) return 0;
  standing.achievementLevels[key] = previous + 1;
  return [25, 50, 100, 200][previous] ?? 0;
}

function achievementBonus(standing: Standing, season2Scoring: boolean): number {
  let bonus = 0;
  bonus += awardAchievement(standing, 'opk', standing.operatorKills, [40, 90, 150, 250]);
  bonus += awardAchievement(standing, 'exf', standing.exfils, [8, 18, 32, 50]);
  bonus += awardAchievement(standing, 'sqk', standing.squadKills, [20, 45, 90, 150]);
  bonus += awardAchievement(standing, 'wc', standing.weaponCases, [4, 9, 18, 30]);
  bonus += awardAchievement(standing, 'fin', standing.finalExfils, [3, 7, 14, 25]);
  bonus += awardAchievement(standing, 'con', standing.contracts, [12, 28, 55, 100]);
  bonus += awardAchievement(standing, 'raids', standing.raids, [10, 22, 40, 65]);

  if (season2Scoring) {
    bonus += awardAchievement(standing, 'boss', standing.bossKills, [4, 9, 18, 30]);
  }

  if (standing.raids >= 10) {
    const killsPerRaid = standing.operatorKills / standing.raids;
    const exfilRate = (standing.exfils / standing.raids) * 100;
    bonus += awardAchievement(standing, 'kpr', killsPerRaid, [0.5, 1.5, 4, 6]);
    bonus += awardAchievement(standing, 'exfr', exfilRate, [45, 65, 82, 95]);
  }
  return bonus;
}

function gross(raid: Raid, season2Scoring: boolean): number {
  let earned = 0;
  if (raid.hasCarryover) earned += raid.carryover;
  earned += raid.operatorKills * 15;
  earned += Math.min(raid.squadKills, 10) * 3;
  if (raid.extracted) {
    earned += 20;
    if (raid.weaponCase) earned += 20;
    if (raid.fullSquad) earned += 10;
    if (raid.finalExfil) earned += 15;
  }
  if (raid.contract === 'regular') earned += 10;
  else if (raid.contract === 'hunt') earned += 20;
  if (season2Scoring) earned += Math.min(raid.bossKills, 2) * 10;
  return earned;
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent':
          'DMZRankedReactWidget/1.0.61 (HarleysStudios; com.harleytg.dmzranked)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWidgetState(): Promise<any> {
  try {
    const publicState = await fetchJson(PUBLIC_STATE_URL);
    if (
      Array.isArray(publicState?.players) &&
      Array.isArray(publicState?.raids) &&
      publicState?.meta?.season
    ) {
      return {
        data: {
          players: publicState.players,
          raids: publicState.raids,
          season: publicState.meta.season
        }
      };
    }
  } catch {
    // Fall through to leaderboard snapshot.
  }
  return await fetchJson(SNAPSHOT_DATA_URL);
}

function resolveStats(root: any, operatorName: string): WidgetStats | null {
  const data = root?.data;
  const players = Array.isArray(data?.players) ? data.players : null;
  const raids = Array.isArray(data?.raids) ? data.raids : null;
  const season = data?.season;
  if (!players || !raids || !season) return null;

  const seasonStart = Number(season.start);
  const seasonEnd = Number(season.end);
  const minTs = Number.isFinite(seasonStart) ? seasonStart : Number.MIN_SAFE_INTEGER;
  const maxTs = Number.isFinite(seasonEnd) ? seasonEnd : Number.MAX_SAFE_INTEGER;
  const season2Scoring = Boolean(season.s2);

  const byId = new Map<string, Standing>();
  for (const player of players) {
    const id = clean(player?.id);
    const name = clean(player?.name);
    if (id) byId.set(id, newStanding(id, name));
  }

  const seasonRaids = raids
    .filter((obj: any) => !obj?.pending && !obj?.deleted)
    .map(raidFrom)
    .filter((raid: Raid) => raid.ts >= minTs && raid.ts <= maxTs)
    .sort((a: Raid, b: Raid) => a.ts - b.ts);

  for (const raid of seasonRaids) {
    let standing = byId.get(raid.playerId);
    if (!standing) {
      standing = newStanding(
        raid.playerId,
        raid.playerName || '?'
      );
      byId.set(raid.playerId, standing);
    }

    const before = standing.sr;
    const fee = feeFor(before);
    let earned = gross(raid, season2Scoring);

    if (!raid.hasCarryover) {
      standing.raids += 1;
      standing.operatorKills += raid.operatorKills;
      standing.squadKills += raid.squadKills;
      if (raid.contract !== 'none') standing.contracts += 1;
      if (raid.extracted) standing.exfils += 1;
      if (raid.finalExfil) standing.finalExfils += 1;
      if (raid.weaponCase && raid.extracted) standing.weaponCases += 1;
      if (season2Scoring) standing.bossKills += Math.min(raid.bossKills, 2);
      earned += achievementBonus(standing, season2Scoring);
    }

    const after = Math.max(0, before - fee + earned);
    standing.sr = after;
    standing.peak = Math.max(standing.peak, after);
    if (!raid.hasCarryover) standing.last = after - before;
  }

  const standings = [...byId.values()].sort((a, b) => {
    if (b.sr !== a.sr) return b.sr - a.sr;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const wanted = clean(operatorName).toLowerCase();
  const position = standings.findIndex(
    standing => clean(standing.name).toLowerCase() === wanted
  );
  if (position < 0) return null;

  const mine = standings[position]!;
  const rank = rankInfo(mine.sr);
  return {
    name: mine.name,
    sr: mine.sr,
    peak: mine.peak,
    lastDelta: mine.last,
    position: position + 1,
    totalPlayers: standings.length,
    rankLabel: rank.label.toUpperCase(),
    progressPct: rank.progressPct,
    srToNext: rank.toNext,
    seasonName: clean(season.name),
    updatedAt: Date.now(),
    fromCache: false
  };
}

function cacheKey(operator: string): string {
  return CACHE_PREFIX + clean(operator).toLowerCase();
}

export async function getWidgetStats(operator: string): Promise<WidgetStats | null> {
  try {
    const root = await fetchWidgetState();
    const stats = resolveStats(root, operator);
    if (stats) {
      await AsyncStorage.setItem(cacheKey(operator), JSON.stringify(stats));
      return stats;
    }
  } catch {
    // Use cache below.
  }

  try {
    const raw = await AsyncStorage.getItem(cacheKey(operator));
    if (!raw) return null;
    const stats = JSON.parse(raw) as WidgetStats;
    return { ...stats, fromCache: true };
  } catch {
    return null;
  }
}

export function tierColor(rankLabel: string): string {
  const label = clean(rankLabel).toUpperCase();
  if (label.startsWith('IRIDESCENT')) return '#C9B3FF';
  if (label.startsWith('CRIMSON')) return '#E5484D';
  if (label.startsWith('DIAMOND')) return '#8FD6FF';
  if (label.startsWith('PLATINUM')) return '#DFE7EE';
  if (label.startsWith('GOLD')) return '#F5C451';
  if (label.startsWith('SILVER')) return '#C3CCD4';
  if (label.startsWith('BRONZE')) return '#C48A5A';
  return '#F6C453';
}
