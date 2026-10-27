// Persistence + native bridge. Electron preload exposes window.tempo; the browser build falls back to localStorage.
import type { CalEvent, Calendar, Account } from '@tempo/core';
export interface Snapshot { accounts: Account[]; calendars: Calendar[]; events: CalEvent[]; prefs: Record<string, unknown> | null }
export interface NativeBridge {
  platform: string;
  load(): Promise<Snapshot>;
  put(kind: 'event' | 'calendar' | 'account', obj: unknown): Promise<void>;
  del(kind: 'event' | 'calendar' | 'account', id: string): Promise<void>;
  putPrefs(p: Record<string, unknown>): Promise<void>;
  on(ch: string, cb: (payload: any) => void): () => void;
  send(ch: string, payload?: unknown): void;
  openIcs(): Promise<{ name: string; text: string } | null>;
  saveIcs(name: string, text: string): Promise<boolean>;
}
declare global { interface Window { tempo?: NativeBridge } }

const LS = 'tempo.v1';
type Mem = { accounts: Record<string, Account>; calendars: Record<string, Calendar>; events: Record<string, CalEvent>; prefs: Record<string, unknown> | null };
function readLs(): Mem { try { const s = localStorage.getItem(LS); if (s) return JSON.parse(s); } catch { /* ignore */ } return { accounts: {}, calendars: {}, events: {}, prefs: null }; }
let mem: Mem | null = null; let t: number | undefined;
const flush = () => { clearTimeout(t); t = window.setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(mem)); } catch { /* quota */ } }, 120); };
const coll = (k: string) => (k === 'event' ? 'events' : k === 'calendar' ? 'calendars' : 'accounts') as 'events' | 'calendars' | 'accounts';

const browser: NativeBridge = {
  platform: 'web',
  async load() { mem = readLs(); return { accounts: Object.values(mem.accounts), calendars: Object.values(mem.calendars), events: Object.values(mem.events), prefs: mem.prefs }; },
  async put(kind, obj: any) { mem ??= readLs(); (mem[coll(kind)] as any)[obj.id] = obj; flush(); },
  async del(kind, id) { mem ??= readLs(); delete (mem[coll(kind)] as any)[id]; flush(); },
  async putPrefs(p) { mem ??= readLs(); mem.prefs = p; flush(); },
  on() { return () => {}; },
  send() {},
  async openIcs() {
    return new Promise((res) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ics,.vcs,text/calendar';
      inp.onchange = async () => { const f = inp.files?.[0]; res(f ? { name: f.name, text: await f.text() } : null); };
      inp.click();
    });
  },
  async saveIcs(name, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })); a.download = name; a.click(); return true;
  },
};
const memoryOnly = new URLSearchParams(location.search).get('storage') === 'memory';
if (memoryOnly) { mem = { accounts: {}, calendars: {}, events: {}, prefs: null }; }
const memBridge: NativeBridge = { ...browser, async load() { return { accounts: [], calendars: [], events: [], prefs: null }; }, async put() {}, async del() {}, async putPrefs() {} };
export const bridge: NativeBridge = memoryOnly ? memBridge : (window.tempo ?? browser);
export const isMac = /Mac/.test(navigator.platform) || bridge.platform === 'darwin' || new URLSearchParams(location.search).get('platform') === 'mac';
export const isElectron = !!window.tempo;
