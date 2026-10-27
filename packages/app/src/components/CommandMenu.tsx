import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowUpDown, CornerDownLeft } from 'lucide-react';
import { setState, getState, occurrencesIn, goToDay, select } from '../store';
import { COMMANDS } from '../commands';
import { t } from '../i18n';
import { parseDateInput } from '../dateinput';
import { longDate } from '../fmt';

type Row = { id: string; label: string; keys?: string[]; run: () => void; section: string };
export function CommandMenu() {
  const [q, setQ] = useState(''); const [act, setAct] = useState(0); const list = useRef<HTMLUListElement>(null);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const cmds: Row[] = COMMANDS.filter((c) => !c.when || c.when()).map((c) => ({ id: c.id, label: t(c.label, c.labelVars), keys: c.keys, run: c.run, section: t(c.section) }))
      .filter((r) => !qq || r.label.toLowerCase().includes(qq) || r.id.toLowerCase().includes(qq));
    const out: Row[] = [...cmds];
    if (qq) {
      const d = parseDateInput(q, getState().today);
      if (d !== null) out.unshift({ id: 'date', label: `${t('jumpTo')} ${longDate(d)}`, run: () => goToDay(d), section: t('secNavigation') });
      const today = getState().today;
      const evs = occurrencesIn(today - 180, today + 365).filter((o) => o.event.title.toLowerCase().includes(qq)).slice(0, 8);
      for (const o of evs) out.push({ id: `ev:${o.key}`, label: o.event.title, keys: undefined, run: () => { goToDay(o.startDay); select([o.key]); }, section: `${t('events')}` });
    }
    return out;
  }, [q]);
  useEffect(() => setAct(0), [q]);
  useEffect(() => { list.current?.querySelector('.act')?.scrollIntoView({ block: 'nearest' }); }, [act]);
  const run = (r?: Row) => { if (!r) return; setState({ overlay: null }); setTimeout(r.run); };
  let lastSec = '';
  return (
    <>
      <div className="scrim dim" onPointerDown={() => setState({ overlay: null })} />
      <div className="cmdk" data-testid="cmdk" role="dialog">
        <div className="cmdk-in"><Search size={18} />
          <input autoFocus placeholder={t('typeCommand')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAct((a) => Math.min(rows.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => Math.max(0, a - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); run(rows[act]); }
            else if (e.key === 'Escape') { setState({ overlay: null }); }
            e.stopPropagation();
          }} /></div>
        <ul className="cmdk-list" ref={list}>
          {rows.length === 0 && <div className="cmdk-empty">{t('noResults')}</div>}
          {rows.map((r, i) => {
            const head = r.section !== lastSec ? (lastSec = r.section) : null;
            return <li key={r.id} style={{ listStyle: 'none' }}>
              {head && <div className="cmdk-sec">{head}</div>}
              <div className={`cmdk-item${i === act ? ' act' : ''}`} onMouseMove={() => setAct(i)} onClick={() => run(r)}>
                <span className="lbl">{r.label}</span>{r.keys && <span className="kbds">{r.keys.map((k, j) => <kbd key={j} className="kbd">{k}</kbd>)}</span>}
              </div>
            </li>;
          })}
        </ul>
        <div className="cmdk-foot"><span><ArrowUpDown size={12} />{t('navigate')}</span><span><CornerDownLeft size={12} />{t('select')}</span><span><kbd className="kbd">esc</kbd>{t('close')}</span></div>
      </div>
    </>
  );
}
