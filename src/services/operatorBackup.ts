import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dmz_operator_backups_v1';
const MAX_OPERATORS = 2;
const MAX_SNAPSHOT_CHARS = 1_500_000;

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

  const storage = { ...snapshot.storage, dmz_myname: name };
  const root = await loadRoot();
  root[normalize(name)] = {
    operator: name,
    savedAt: Date.now(),
    origin: snapshot.origin || 'https://dmzranked.com',
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
      if (!name || !record?.storage) continue;
      root[normalize(name)] = {
        operator: name,
        savedAt: Number(record.savedAt) || Date.now(),
        origin: record.origin || 'https://dmzranked.com',
        storage: { ...record.storage, dmz_myname: name },
        entryCount: Object.keys(record.storage).length,
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

  const statements = Object.entries(record.storage)
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
    "return 'restored:'+restored;}catch(e){return 'error:'+String(e&&e.message||e);}})();true;"
  ].join('');
}
