import { t, Key } from '../i18n';
import { MOD } from '../commands';
import { isMac } from '../platform';
import { setState } from '../store';
import { Kbd } from './Panel';

// Row = [label, alternatives]; a string row is a sub-heading ("Selected events…").
type Row = [Key, string[][], string?] | Key;
const CTRL = isMac ? '⌃' : 'Ctrl'; const ALT = isMac ? '⌥' : 'Alt';
const GROUPS: [Key, Row[]][] = [
  ['shortcutsGlobal', [['sTrayCal', [[CTRL, MOD, 'K']]], ['sJoinGlobal', [[CTRL, MOD, 'J']]]]],
  ['shortcutsGeneral', [['commandMenu', [[MOD, 'K']]], ['sSidebar', [['\\']]], ['sPanel', [[MOD, '\\']]], ['sTheme', [['⇧', MOD, 'L']]], ['sSave', [['return'], [MOD, 'return']]], ['sEsc', [['esc']]],
    ['sUndo', [[MOD, 'Z']]], ['sRedo', [['⇧', MOD, 'Z']]], ['sAddSel', [['⇧'], [MOD]], 'click'], ['sSelectAll', [[MOD, 'A']]], ['sSearch', [['/'], [MOD, 'F']]], ['sSettings', [[MOD, ',']]], ['sShortcuts', [['?']]]]],
  ['shortcutsEvents', [['sCreate', [['C'], [MOD, 'N']]], ['sJoin', [[MOD, 'J']]], ['sAvail', [['S']]], 'sSelectedHdr', ['sDelete', [['delete']]], ['sCut', [[MOD, 'X']]], ['sCopy', [[MOD, 'C']]], ['sDuplicate', [[MOD, 'D'], [ALT]], 'drag'], ['sEditField', [['E']]], 'sCopiedHdr', ['sPaste', [[MOD, 'V']]]]],
  ['shortcutsViews', [['sDay', [['1'], ['D']]], ['sWeek', [['0'], ['W']]], ['sNDays', [['2 – 9']]], ['sMonth', [['M']]], ['sZoomIn', [['⇧', MOD, '.']]], ['sZoomOut', [['⇧', MOD, ',']]], ['sZoomReset', [['⇧', MOD, '0']]], ['sAllDay', [['⇧', MOD, 'A']]], ['showWeekends', [['⇧', MOD, 'E']]], ['showDeclined', [['⇧', MOD, 'D']]], ['sTzToggle', [['Z']]]]],
  ['shortcutsNav', [['sToday', [['T']]], ['alignToday', [[ALT, 'T']]], ['sNext', [['J'], ['→']]], ['sPrev', [['K'], ['←']]], ['goToDate', [['.'], ['G', '.']]]]],
];
// Mac keycaps spell modifiers out, like the system menus do in this style.
const WORD: Record<string, string> = { '⇧': 'shift', '⌥': 'option', '⌃': 'control' };
const cap = (k: string) => (isMac ? WORD[k] ?? k : k === '⇧' ? 'Shift' : k);
export function ShortcutList({ filter = '' }: { filter?: string }) {
  const q = filter.trim().toLowerCase();
  return (
    <div className="ps" data-testid="shortcuts">
      {GROUPS.map(([g, rows]) => {
        const vis = rows.filter((r) => typeof r === 'string' ? !q : !q || t(r[0]).toLowerCase().includes(q));
        if (!vis.some((r) => typeof r !== 'string')) return null;
        return <div key={g} className="ps-grp">
          <div className="ps-title">{t(g)}</div>
          <ul className="ps-list">{vis.map((r) => typeof r === 'string' ? <li key={r} className="sub">{t(r)}</li> : <li key={r[0]}><span>{t(r[0])}</span><span className="kbds">{r[1].map((k, i) => <span key={i} className="kbds">{i > 0 && <span className="or">{t('or')}</span>}<Kbd keys={k.map(cap)} /></span>)}{r[2] && <span className="or">{t(r[2] === 'click' ? 'sClick' : 'drag')}</span>}</span></li>)}
            {g === 'shortcutsGlobal' && !q && <li className="link" onClick={() => setState({ overlay: 'settings', settingsPage: 'menubar' })}><span>{t('menuBarSettings')} →</span></li>}</ul>
        </div>;
      })}
    </div>
  );
}
