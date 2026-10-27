import { t, Key } from '../i18n';
import { MOD } from '../commands';
import { Kbd } from './Panel';

const GROUPS: [Key, [Key, string[][]][]][] = [
  ['shortcutsGeneral', [['commandMenu', [[MOD, 'K']]], ['sSearch', [['/'], [MOD, 'F']]], ['sSidebar', [['\\']]], ['sPanel', [[MOD, '\\']]], ['sTheme', [['⇧', MOD, 'L']]], ['sSettings', [[MOD, ',']]], ['sShortcuts', [['?']]], ['sSave', [['return']]], ['sEsc', [['esc']]], ['sUndo', [[MOD, 'Z']]], ['sRedo', [['⇧', MOD, 'Z']]], ['sSelectAll', [[MOD, 'A']]]]],
  ['shortcutsViews', [['sDay', [['1'], ['D']]], ['sWeek', [['0'], ['W']]], ['sNDays', [['2 – 9']]], ['sMonth', [['M']]], ['sZoomIn', [['⇧', MOD, '.']]], ['sZoomOut', [['⇧', MOD, ',']]], ['sZoomReset', [['⇧', MOD, '0']]], ['sAllDay', [['⇧', MOD, 'A']]], ['showWeekends', [['⇧', MOD, 'E']]], ['showDeclined', [['⇧', MOD, 'D']]]]],
  ['shortcutsNav', [['sToday', [['T']]], ['sNext', [['J'], ['→']]], ['sPrev', [['K'], ['←']]], ['goToDate', [['.']]]]],
  ['shortcutsEvents', [['sCreate', [['C']]], ['sDelete', [['delete']]], ['sCut', [[MOD, 'X']]], ['sCopy', [[MOD, 'C']]], ['sPaste', [[MOD, 'V']]], ['sDuplicate', [[MOD, 'D']]]]],
];
export function ShortcutList({ filter = '' }: { filter?: string }) {
  const q = filter.trim().toLowerCase();
  return (
    <div className="ps" data-testid="shortcuts">
      {GROUPS.map(([g, rows]) => {
        const vis = rows.filter(([l]) => !q || t(l).toLowerCase().includes(q));
        if (!vis.length) return null;
        return <div key={g} style={{ marginBottom: 18 }}>
          <div className="ps-title">{t(g)}</div>
          <ul className="ps-list">{vis.map(([l, alts]) => <li key={l}><span>{t(l)}</span><span className="kbds">{alts.map((k, i) => <span key={i} className="kbds">{i > 0 && <span style={{ margin: '0 2px' }}>{t('or')}</span>}<Kbd keys={k} /></span>)}</span></li>)}</ul>
        </div>;
      })}
    </div>
  );
}
