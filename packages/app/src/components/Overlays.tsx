import { useState } from 'react';
import { useStore, setState, getState, goToDay } from '../store';
import { t } from '../i18n';
import { parseDateInput } from '../dateinput';
import { longDate } from '../fmt';

export function Toasts() {
  const ts = useStore((x) => x.toasts);
  return <div className="toasts" data-testid="toasts">{ts.map((x) => <div key={x.id} className="toast"><span>{x.text}</span>{x.undo && <button onClick={() => { x.undo!(); setState((s) => ({ toasts: s.toasts.filter((y) => y.id !== x.id) })); }}>{t('undo')}</button>}</div>)}</div>;
}
export function ScopeDialog() {
  const a = useStore((x) => x.scopeAsk); if (!a) return null;
  return <><div className="scrim dim" onPointerDown={() => a.resolve(null)} />
    <div className="dialog" data-testid="scope" role="dialog" onKeyDown={(e) => { if (e.key === 'Escape') a.resolve(null); }}>
      <h3>{a.kind === 'delete' ? t('deleteRecurring') : t('editRecurring')}</h3>
      <div className="opts">
        <button className="btn" autoFocus onClick={() => a.resolve('this')}>{t('thisEvent')}</button>
        <button className="btn" onClick={() => a.resolve('following')}>{t('thisAndFollowing')}</button>
        <button className="btn" onClick={() => a.resolve('all')}>{t('allEvents')}</button>
      </div>
    </div></>;
}
export function GotoDialog() {
  const [q, setQ] = useState(''); const d = parseDateInput(q, getState().today);
  return <><div className="scrim" onPointerDown={() => setState({ overlay: null })} />
    <div className="cmdk" data-testid="goto" style={{ width: 380, marginLeft: -190 }}>
      <div className="cmdk-in"><input autoFocus placeholder={t('enterDate')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && d !== null) { goToDay(d); setState({ overlay: null }); } if (e.key === 'Escape') setState({ overlay: null }); }} /></div>
      {d !== null && <div className="cmdk-list"><div className="cmdk-item act">{longDate(d)}</div></div>}
    </div></>;
}
