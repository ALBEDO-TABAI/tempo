import { useEffect, useLayoutEffect, useState, RefObject } from 'react';
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [s, set] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => set({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); set({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return s;
}
export function useWindowEvent<K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, deps: unknown[] = []) {
  useEffect(() => { window.addEventListener(type, fn as any); return () => window.removeEventListener(type, fn as any); }, deps); // eslint-disable-line
}
