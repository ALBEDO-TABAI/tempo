import { useState } from 'react';
import { useStore, setState, getState, goToDay, findOccurrence, updateOccurrence } from '../store';
import { parseRRule, stringifyRRule, weekday, ymd, isoDate, parseIsoDate, RRule } from '@tempo/core';
import { t } from '../i18n';
import { parseDateInput } from '../dateinput';
import { longDate, wdShort, ruleLabel } from '../fmt';

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

/** Custom recurrence editor: frequency + interval, weekdays (weekly), day-of-month vs nth weekday (monthly), end condition. */
export function RecurrenceDialog() {
  const key = useStore((x) => x.recKey); const occ = key ? findOccurrence(key) : undefined;
  const series = occ ? (occ.seriesId ? getState().events[occ.seriesId] : occ.event) : undefined;
  const init: RRule = series?.rrule ? parseRRule(series.rrule) : { freq: 'WEEKLY', interval: 1, wkst: 1, byDay: occ ? [{ wd: weekday(occ.startDay) }] : [] };
  const day = occ?.startDay ?? getState().today; const wd = weekday(day); const { d } = ymd(day); const nth = Math.ceil(d / 7);
  const [freq, setFreq] = useState(init.freq === 'DAILY' || init.freq === 'WEEKLY' || init.freq === 'MONTHLY' || init.freq === 'YEARLY' ? init.freq : 'WEEKLY');
  const [interval, setInterval] = useState(init.interval || 1);
  const [days, setDays] = useState<number[]>(init.byDay?.filter((b) => !b.n).map((b) => b.wd) ?? [wd]);
  const [mMode, setMMode] = useState<'day' | 'nth'>(init.byDay?.some((b) => b.n) ? 'nth' : 'day');
  const [end, setEnd] = useState<'never' | 'until' | 'count'>(init.count ? 'count' : init.until !== undefined ? 'until' : 'never');
  const [count, setCount] = useState(init.count ?? 10);
  const [until, setUntil] = useState(isoDate(init.until !== undefined && init.untilIsDate ? init.until : day + 90));
  if (!occ) return null;
  const build = (): RRule => {
    const r: RRule = { freq, interval: Math.max(1, interval), wkst: 1 };
    if (freq === 'WEEKLY') r.byDay = (days.length ? days : [wd]).slice().sort().map((x) => ({ wd: x }));
    if (freq === 'MONTHLY') { if (mMode === 'day') r.byMonthDay = [d]; else r.byDay = [{ wd, n: nth > 4 ? -1 : nth }]; }
    if (end === 'count') r.count = Math.max(1, count);
    if (end === 'until') { r.until = parseIsoDate(until); r.untilIsDate = true; }
    return r;
  };
  const close = () => setState({ overlay: null, recKey: null });
  const save = () => { const rule = stringifyRRule(build()); updateOccurrence(key!, { rrule: rule }, { scope: series?.rrule ? 'all' : undefined }); close(); };
  const units: Record<string, string> = { DAILY: interval > 1 ? t('uDays') : t('uDay'), WEEKLY: interval > 1 ? t('uWeeks') : t('uWeek'), MONTHLY: interval > 1 ? t('uMonths') : t('uMonth'), YEARLY: interval > 1 ? t('uYears') : t('uYear') };
  const ord = t('ordN').split('|');
  return <><div className="scrim dim" onPointerDown={close} />
    <div className="dialog rec" data-testid="recurrence" role="dialog" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') close(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}>
      <h3>{t('customRepeat')}</h3>
      <div className="rec-row"><span className="rec-l">{t('every')}</span>
        <input data-testid="rec-interval" type="number" min={1} max={99} value={interval} onChange={(e) => setInterval(Math.max(1, Math.min(99, +e.target.value || 1)))} />
        <select data-testid="rec-freq" value={freq} onChange={(e) => setFreq(e.target.value as any)}>{(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((f) => <option key={f} value={f}>{units[f]}</option>)}</select></div>
      {freq === 'WEEKLY' && <div className="rec-row"><span className="rec-l">{t('repeatOn')}</span><div className="rec-days">{[0, 1, 2, 3, 4, 5, 6].map((x) => <button key={x} data-testid={`rec-day-${x}`} className={days.includes(x) ? 'on' : ''} onClick={() => setDays((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]))}>{wdShort(x).replace(/^週|^周/, '')}</button>)}</div></div>}
      {freq === 'MONTHLY' && <div className="rec-row"><span className="rec-l" /><select data-testid="rec-mmode" value={mMode} onChange={(e) => setMMode(e.target.value as any)}>
        <option value="day">{t('monthDayN', { n: d })}</option><option value="nth">{t('monthNth', { o: ord[nth > 4 ? 4 : nth - 1], d: wdShort(wd) })}</option></select></div>}
      <div className="rec-row top"><span className="rec-l">{t('ends')}</span><div className="rec-ends">
        <label><input type="radio" name="rec-end" checked={end === 'never'} onChange={() => setEnd('never')} />{t('never')}</label>
        <label><input type="radio" name="rec-end" data-testid="rec-end-until" checked={end === 'until'} onChange={() => setEnd('until')} />{t('onDate')}<input type="date" value={until} disabled={end !== 'until'} onChange={(e) => setUntil(e.target.value)} /></label>
        <label><input type="radio" name="rec-end" data-testid="rec-end-count" checked={end === 'count'} onChange={() => setEnd('count')} />{t('after')}<input type="number" data-testid="rec-count" min={1} max={999} value={count} disabled={end !== 'count'} onChange={(e) => setCount(Math.max(1, +e.target.value || 1))} />{t('occurrencesN')}</label>
      </div></div>
      <div className="rec-sum" data-testid="rec-summary">{ruleLabel(build())}</div>
      <div className="opts end"><button className="btn" onClick={close}>{t('cancel')}</button><button className="btn primary" data-testid="rec-done" onClick={save}>{t('done')}</button></div>
    </div></>;
}
