/**
 * Local calendar store owned by the main process: better-sqlite3 (WAL) when the native module loads,
 * otherwise a JSON file with the same interface.
 */
import fs from 'node:fs';

export type Kind = 'event' | 'calendar' | 'account';
export interface Snapshot { accounts: unknown[]; calendars: unknown[]; events: unknown[]; prefs: Record<string, unknown> | null }
export interface Store { kind: 'sqlite' | 'json'; file: string; load(): Snapshot; put(kind: Kind, obj: { id: string }): void; del(kind: Kind, id: string): void; putPrefs(p: unknown): void; clear(): void; close(): void }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS item (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (kind, id));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
PRAGMA user_version = 1;`;
const KINDS: Kind[] = ['account', 'calendar', 'event'];

function sqliteStore(file: string): Store {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const db = new Database(file);
  db.pragma('journal_mode = WAL'); db.pragma('synchronous = NORMAL'); db.exec(SCHEMA);
  const put = db.prepare('INSERT INTO item (kind, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
  const del = db.prepare('DELETE FROM item WHERE kind = ? AND id = ?');
  const all = db.prepare('SELECT data FROM item WHERE kind = ?');
  const putMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
  return {
    kind: 'sqlite', file,
    load() {
      const [accounts, calendars, events] = KINDS.map((k) => (all.all(k) as { data: string }[]).map((r) => JSON.parse(r.data)));
      const p = getMeta.get('prefs') as { value: string } | undefined;
      return { accounts, calendars, events, prefs: p ? JSON.parse(p.value) : null };
    },
    put: (k, o) => { put.run(k, o.id, JSON.stringify(o), Date.now()); },
    del: (k, id) => { del.run(k, id); },
    putPrefs: (p) => { putMeta.run('prefs', JSON.stringify(p)); },
    clear: () => { db.exec('DELETE FROM item; DELETE FROM meta;'); },
    close: () => db.close(),
  };
}

function jsonStore(file: string): Store {
  type D = { account: Record<string, unknown>; calendar: Record<string, unknown>; event: Record<string, unknown>; prefs: Record<string, unknown> | null };
  let d: D;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { d = { account: {}, calendar: {}, event: {}, prefs: null }; }
  let timer: NodeJS.Timeout | undefined;
  const flush = () => { clearTimeout(timer); fs.writeFileSync(file + '.tmp', JSON.stringify(d)); fs.renameSync(file + '.tmp', file); };
  const later = () => { clearTimeout(timer); timer = setTimeout(flush, 150); };
  return {
    kind: 'json', file,
    load: () => ({ accounts: Object.values(d.account), calendars: Object.values(d.calendar), events: Object.values(d.event), prefs: d.prefs }),
    put: (k, o) => { d[k][o.id] = o; later(); },
    del: (k, id) => { delete d[k][id]; later(); },
    putPrefs: (p) => { d.prefs = p as Record<string, unknown>; later(); },
    clear: () => { d = { account: {}, calendar: {}, event: {}, prefs: null }; flush(); },
    close: flush,
  };
}

export function openStore(dir: string): Store {
  if (process.env.TEMPO_FORCE_JSON !== '1') {
    try { return sqliteStore(`${dir}/tempo.db`); } catch (e) { console.error('[tempo] better-sqlite3 unavailable, using JSON storage:', (e as Error).message); }
  }
  return jsonStore(`${dir}/tempo.json`);
}
