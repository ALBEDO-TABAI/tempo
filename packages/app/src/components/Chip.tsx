import { CSSProperties, memo } from 'react';
import { colorFamily, Occurrence } from '@tempo/core';
import { calendarOf, getState, isDark } from '../store';
import { rangeOf, timeOf } from '../fmt';
import { t } from '../i18n';

export function chipVars(occ: Occurrence, dark: boolean, now: number, selected: boolean): CSSProperties {
  const cal = calendarOf(occ.event.calendarId);
  const base = occ.event.color || cal?.color || '#9A9CFE';
  const f = colorFamily(base, dark), rf = colorFamily(cal?.color || base, dark);
  const past = !selected && occ.end <= now;
  return {
    ['--bg1' as any]: f.backgroundPrimary,
    ['--bg2' as any]: past ? f.backgroundSecondaryDimmed : f.backgroundSecondary,
    ['--fg' as any]: past ? f.foregroundPrimaryDimmed : f.foregroundPrimary,
    ['--fg2' as any]: past ? f.foregroundSecondaryDimmed : f.foregroundSecondary,
    ['--rib' as any]: past ? rf.backgroundPrimaryDimmed : rf.backgroundPrimary,
    ['--hl1' as any]: dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.35)',
    ['--hl2' as any]: dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.25)',
  };
}
export interface ChipProps {
  occ: Occurrence; x: number; y: number; w: number; h: number; layer?: number; kind: 'timed' | 'allday' | 'dot';
  selected?: boolean; moving?: boolean; ghost?: boolean; clipL?: boolean; clipR?: boolean; startOverride?: number; endOverride?: number;
  onDown?: (e: React.PointerEvent, occ: Occurrence, part: 'body' | 'n' | 's' | 'w' | 'e') => void; onContext?: (e: React.MouseEvent, occ: Occurrence) => void; onDbl?: (occ: Occurrence) => void;
}
export const Chip = memo(function Chip(p: ChipProps) {
  const s = getState(); const dark = isDark(s); const h24 = s.prefs.format24HourTime; const tz = s.prefs.primaryTimeZone;
  const ev = p.occ.event; const start = p.startOverride ?? p.occ.start, end = p.endOverride ?? p.occ.end;
  const style: CSSProperties = { ...chipVars(p.occ, dark, s.now, !!(p.selected || p.moving)), left: p.x, top: p.y, width: Math.max(0, p.w), height: p.h, zIndex: 200 + (p.layer ?? 1) };
  const declined = ev.attendees?.some((a) => a.self && a.rsvp === 'declined');
  const cls = ['chip', p.kind === 'allday' && 'allday', p.kind === 'dot' && 'dot', p.selected && 'selected', p.moving && 'moving', p.ghost && 'ghost',
    ev.status === 'tentative' && 'tentative', declined && 'declined', ev.transparency === 'transparent' && p.kind === 'timed' && 'free', p.clipL && 'clipL', p.clipR && 'clipR'].filter(Boolean).join(' ');
  const title = ev.title || t('noTitle');
  const down = (part: 'body' | 'n' | 's' | 'w' | 'e') => (e: React.PointerEvent) => { e.stopPropagation(); p.onDown?.(e, p.occ, part); };
  const common = { 'data-key': p.occ.key, className: cls, style, onPointerDown: down('body'), onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); p.onContext?.(e, p.occ); }, onDoubleClick: (e: React.MouseEvent) => { e.stopPropagation(); p.onDbl?.(p.occ); } };
  if (p.kind === 'allday') {
    return <div {...common}><div className="ttl">{title}</div>{!p.occ.allDay && !p.occ.isMultiDay && <div className="tm" style={{ marginTop: 0, marginLeft: 4 }}>{timeOf(start, tz, h24)}</div>}{!p.clipL && <div className="rz w" onPointerDown={down('w')} />}{!p.clipR && <div className="rz e" onPointerDown={down('e')} />}</div>;
  }
  if (p.kind === 'dot') {
    return <div {...common} className={`${cls} compact`}><div className="tm">{timeOf(start, tz, h24)}</div><div className="ttl">{title}</div></div>;
  }
  // timed: one compact line when there is no room for the time row
  const compact = p.h + 0.05 < 29; // 1 pad + 2 + 13 title + 2 + 11 time
  const lines = Math.max(1, Math.floor((p.h - 4 - 13) / 13));
  return (
    <div {...common} className={`${cls}${compact ? ' compact' : ''}`}>
      {compact ? (<><div className="ttl">{title}</div><div className="tm">{timeOf(start, tz, h24)}</div></>) : (
        <><div className="ttl" style={{ maxHeight: lines * 13 }}>{title}</div><div className="tm">{rangeOf(start, end, tz, h24)}</div></>
      )}
      <div className="rz n" onPointerDown={down('n')} /><div className="rz s" onPointerDown={down('s')} />
    </div>
  );
});
