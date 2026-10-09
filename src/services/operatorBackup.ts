import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dmz_operator_backups_v1';
const MAX_OPERATORS = 2;
const MAX_SNAPSHOT_CHARS = 1_500_000;
const MAX_STORAGE_CHARS = 1_000_000;
const MAX_VALUE_CHARS = 300_000;
const BLOCKED_KEY =
  /pin|pass(word|code)?|token|auth|session|secret|cookie|credential|jwt|bearer|csrf|oauth|api[_.-]?key/i;
const JWT_VALUE =
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const BLOCKED_VALUE =
  /["'](?:access_?token|refresh_?token|password|passcode|session|secret|authorization|oauth|jwt|api_?key)["']?\s*[:=]/i;

export type OperatorSnapshot = {
  origin?: string;
  storage: Record<string, string>;
  protected?: boolean;
  verified?: boolean;
};

export type OperatorBackupRecord = {
  operator: string;
  savedAt: number;
  origin: string;
  storage: Record<string, string>;
  entryCount: number;
  protected: boolean;
};

type BackupRoot = Record<string, OperatorBackupRecord>;

function cleanName(value: string): string {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? clean.slice(0, 80) : clean;
}

function normalize(value: string): string {
  return cleanName(value).toLowerCase();
}

function safeOrigin(value: unknown): string {
  try {
    const url = new URL(String(value || 'https://dmzranked.com'));
    const host = url.hostname.toLowerCase();
    if (host === 'dmzranked.com' || host.endsWith('.dmzranked.com')) {
      return url.origin;
    }
  } catch {
    // Default below.
  }
  return 'https://dmzranked.com';
}

function isSafeStorageEntry(key: string, value: string): boolean {
  if (!key || BLOCKED_KEY.test(key)) return false;
  if (value.length > MAX_VALUE_CHARS) return false;
  return !JWT_VALUE.test(value) && !BLOCKED_VALUE.test(value);
}

function sanitizeStorage(
  source: Record<string, string>,
  operatorName: string
): Record<string, string> {
  const safe: Record<string, string> = {};
  let total = 0;

  for (const [rawKey, rawValue] of Object.entries(source || {})) {
    const key = String(rawKey || '');
    const value = String(rawValue ?? '');
    if (!isSafeStorageEntry(key, value)) continue;
    const next = total + key.length + value.length;
    if (next > MAX_STORAGE_CHARS) break;
    safe[key] = value;
    total = next;
  }

  const name = cleanName(operatorName);
  if (name) safe.dmz_myname = name;
  return safe;
}

async function loadRoot(): Promise<BackupRoot> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BackupRoot) : {};
    return prune(parsed);
  } catch {
    return {};
  }
}

function prune(root: BackupRoot): BackupRoot {
  const entries = Object.entries(root).sort(
    (left, right) => (right[1]?.savedAt ?? 0) - (left[1]?.savedAt ?? 0)
  );
  return Object.fromEntries(entries.slice(0, MAX_OPERATORS));
}

async function persist(root: BackupRoot): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prune(root)));
}

export async function saveOperatorBackup(
  operatorName: string,
  snapshot: OperatorSnapshot
): Promise<boolean> {
  const name = cleanName(operatorName);
  if (!name || !snapshot?.storage) return false;

  const rawSize = JSON.stringify(snapshot).length;
  if (rawSize > MAX_SNAPSHOT_CHARS) return false;

  const storage = sanitizeStorage(snapshot.storage, name);
  const root = await loadRoot();
  root[normalize(name)] = {
    operator: name,
    savedAt: Date.now(),
    origin: safeOrigin(snapshot.origin),
    storage,
    entryCount: Object.keys(storage).length,
    protected: Boolean(snapshot.protected)
  };
  await persist(root);
  return true;
}

export async function getOperatorBackup(
  operatorName: string
): Promise<OperatorBackupRecord | null> {
  const root = await loadRoot();
  return root[normalize(operatorName)] ?? null;
}

export async function latestOperatorBackup(): Promise<OperatorBackupRecord | null> {
  const root = await loadRoot();
  return (
    Object.values(root).sort((a, b) => b.savedAt - a.savedAt)[0] ?? null
  );
}

export async function operatorBackupCount(): Promise<number> {
  return Object.keys(await loadRoot()).length;
}

export async function operatorNames(): Promise<string[]> {
  const root = await loadRoot();
  return Object.values(root)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_OPERATORS)
    .map(record => record.operator)
    .filter(Boolean);
}

export async function exportOperatorBackups(): Promise<string> {
  return JSON.stringify(await loadRoot());
}

export async function importOperatorBackups(raw: string): Promise<number> {
  try {
    const incoming = JSON.parse(raw) as BackupRoot;
    const root = await loadRoot();
    let imported = 0;

    for (const record of Object.values(incoming)) {
      const name = cleanName(record?.operator || '');
      if (!name || !record?.storage || typeof record.storage !== 'object' || Array.isArray(record.storage)) continue;
      const savedAt = Number(record.savedAt) || Date.now();
      // Never replace a current React backup with an older Java/peer snapshot.
      if (root[normalize(name)] && root[normalize(name)].savedAt >= savedAt) continue;
      root[normalize(name)] = {
        operator: name,
        savedAt,
        origin: safeOrigin(record.origin),
        storage: sanitizeStorage(record.storage, name),
        entryCount: Object.keys(sanitizeStorage(record.storage, name)).length,
        protected: Boolean(record.protected)
      };
      imported += 1;
    }

    await persist(root);
    return Math.min(imported, MAX_OPERATORS);
  } catch {
    return 0;
  }
}

export function buildOperatorRestoreScript(
  record: OperatorBackupRecord
): string | null {
  if (!record?.storage || !Object.keys(record.storage).length) return null;

  const safeStorage = sanitizeStorage(record.storage, record.operator);
  const statements = Object.entries(safeStorage)
    .filter(([key, value]) => key != null && value != null)
    .map(
      ([key, value]) =>
        `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(value)});restored++;`
    )
    .join('');

  const operator = cleanName(record.operator);
  return [
    '(function(){try{var restored=0;',
    statements,
    operator
      ? `localStorage.setItem('dmz_myname',${JSON.stringify(operator)});`
      : '',
    "return 'restored:'+restored;}catch(e){return 'error:'+String(e&&e.message||e);}})()"
  ].join('');
}
