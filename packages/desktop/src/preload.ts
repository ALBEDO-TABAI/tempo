/** Preload: exposes the storage + shell bridge as window.tempo (matches NativeBridge in app/src/platform.ts). */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('tempo', {
  platform: process.platform,
  load: () => ipcRenderer.invoke('tempo:load'),
  put: (kind: string, obj: unknown) => ipcRenderer.invoke('tempo:put', kind, obj),
  del: (kind: string, id: string) => ipcRenderer.invoke('tempo:del', kind, id),
  putPrefs: (p: unknown) => ipcRenderer.invoke('tempo:prefs', p),
  openIcs: () => ipcRenderer.invoke('tempo:open-ics'),
  saveIcs: (name: string, text: string) => ipcRenderer.invoke('tempo:save-ics', name, text),
  send: (ch: string, payload?: unknown) => ipcRenderer.send('tempo:msg', ch, payload),
  test: (op: string, arg?: string) => ipcRenderer.invoke('tempo:test', op, arg),
  on: (ch: string, cb: (payload: unknown) => void) => {
    const h = (_e: IpcRendererEvent, c: string, payload: unknown) => { if (c === ch) cb(payload); };
    ipcRenderer.on('tempo:evt', h);
    return () => { ipcRenderer.removeListener('tempo:evt', h); };
  },
});
