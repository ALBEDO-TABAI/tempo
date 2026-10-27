# Tempo — progress (resumable)

Recreation of a desktop calendar (reference: Notion Calendar 1.132.0 for macOS) under our own brand.
Research (raw refs, which hold private data) lives outside the repo in /workspace/ncal-research
(SPEC.md, RE_NOTES.md, ref/ with 141 captures + INDEX.md, cap/q.py + qr.py query helpers).

**Rules.** Original code only. Do not copy upstream source, strings, logos, icons, fonts or sprites; values and behaviour may match.
Use Lucide icons and the system font stack. Never use the reference app's keys or tokens, and never call its APIs.
**Do not push.** Refs stay outside the repo, and docs/parity holds only redacted side-by-sides.

## Layout
| package | what |
|---|---|
| packages/tokens | design tokens (colours, type scale, chip metrics, grid constants), generated css/ts |
| packages/core | dates, tz (Intl, DST gap/overlap), rrule (RFC 5545 subset + exceptions), ics import/export, layout (overlap columns, span packing), color families, model — vitest 18/18 |
| packages/app | React 19 + Vite 7 renderer; harness URL params (`harness=1&storage=memory&fixture=parity|empty&tz&now&freeze=1&theme&locale&days&view&date&sidebar&panel&platform=mac`), `window.__tempo` |
| packages/desktop | Electron 44.9.3 shell (esbuild → dist/*.cjs), better-sqlite3 store with JSON fallback, electron-builder config |
| packages/parity | pixel.mjs, geometry.mjs, behaviour.mjs, electron.mjs, probe.mjs, redact.py, cdp-lite.mjs |
| scripts | import-tokens.mjs, build-mac.sh, zip-app.py |

## Features done
- **Grid.** Week, N-day (1–9) and month views, with the measured formulas:
  - hour = max(48 + 8·zoom, avail/24, 16);
  - gutter = 26 + 46·tzCount;
  - colW = ceil((W − gutter)/n);
  - chip h = dur·hourH/60 − 3, compact under 29;
  - month row height = body/6.
- **Grid extras.** All-day lane (collapsible), now line, weekends and declined events toggles, week numbers, multiple time zones in the gutter (Z toggles them), out-of-month dimming.
- **Interactions.**
  - Drag to create, move or resize, across days and the all-day lane. Alt-drag duplicates.
  - Multi-select (shift/⌘), copy, cut, paste and duplicate, undo/redo.
  - Recurrence scope dialog (this / following / all).
- **Event panel.** Measured layout covering title, time, date, all-day, tz, repeat, participants, video, colour, location, link, notes, calendar, busy/visibility and reminders. Custom recurrence dialog (freq / interval / weekdays / monthly nth / until / count).
- **Availability mode (S).** Drag slots, suggest free time, copy as text, create holds.
- **⌘K command menu**, search, go-to-date, and the shortcuts list (structured like the ref, with mac keycap words).
- **All shortcuts.** 1/D, 0/W, 2–9, M, T, ⌥T, J/K/arrows, C, ⌘N, S, Z, ?, /, ., g-sequences, e+field, ⌘J, ⌘⏎, ⌘⌫, ⇧⌘L, ⇧⌘. / ⇧⌘, / ⇧⌘0, ⇧⌘A/E/D, \ and ⌘\.
- **Settings modal.** Measured frame: 954×650 at y = 100, radius 12, 253-px nav, 28-px rows, content padding 24/32, 17-px headings, 24×14 toggles, 190×30 dropdowns. Pages:
  - 一般: view, navigation, meetings, language, time format, time zones, location provider, theme, default duration, start at login;
  - 個人檔案;
  - 通知: on/off, sound, default reminders;
  - 選單列;
  - 線上會議: default provider and personal link, auto-added when participants are added;
  - 日曆 on this Mac: rename, colour, export, delete, add, import.
- **Electron shell.**
  - Work-area-based window sizing with saved bounds, hidden-inset titlebar, hide on close (mac).
  - Native menus in en / zh-TW / zh-CN.
  - Tray showing the next event (configurable length, can be turned off).
  - Reminder card window plus native notification.
  - Global ⌃⌘K (tray menu) and ⌃⌘J (join next call).
  - Single instance; `.ics`/`.vcs` open (file association, second instance, open-file); `tempo://event/<id>` and `tempo://day/<date>` deep links.
  - Login item; theme → nativeTheme.
  - SQLite (WAL) with JSON fallback.

## Test and parity status (2026-10-28 03:16 JST)
- core vitest: **18/18**.
- behaviour.mjs: **50/50**.
- electron.mjs (Xvfb, real Electron): **24/24**.
- geometry.mjs: 39 chips, **max error 0.18 px**.
- pixel.mjs (22 states, light and dark): **mean pixel 98.3%, layout 94.7%**. Table in docs/parity/PIXEL.md; side-by-sides are docs/parity/<state>.png (redacted ref | Tempo | diff).
  - **Known residuals.** month (91%): the reference account has a public-holiday calendar that the synthetic fixture lacks.
  - shortcuts_dark (89.5%): the row set differs, since we only list shortcuts that Tempo implements.
  - Glyph rasterisation differs between macOS fonts and the Linux fallbacks.

## Build
`scripts/build-mac.sh` → /workspace/dist-parts/tempo-mac-arm64-v1.zip (+ .zip.part00–04 at 25 MB, MD5SUMS-tempo-mac-arm64-v1.txt). Steps: ad-hoc signed via rcodesign, darwin-arm64 better-sqlite3 prebuild unpacked. See docs/MAC_TEST.md.

## Not shipped (gaps)
- Cloud accounts and sync (Google/Outlook/CalDAV). Calendars are local; import/export goes through .ics.
- Invitations and e-mail sending, RSVP to others, "meet with" overlay of other people's calendars, and public scheduling links. Holds are local only.
- Docs/database integration and AI features.
- Notarisation and a Developer ID signature: the build is ad-hoc signed, so the first launch needs right-click → Open.

## How to resume
1. `cd packages/app && npx vite --port 5300 --host 127.0.0.1` (dev server).
2. Re-create the parity symlinks after any `npm install`: `packages/parity/node_modules/{playwright,playwright-core,pixelmatch,pngjs}` → `/workspace/inkwell/node_modules/*`.
3. Electron binaries: `node node_modules/electron/install.js` (npm blocks install scripts). Zips are cached in ~/.cache/electron.
4. Tests (from packages/parity):
   - `node pixel.mjs` (`ONLY=regex` for a subset);
   - `node --experimental-websocket behaviour.mjs`;
   - `node --experimental-websocket electron.mjs`;
   - `node geometry.mjs`.
5. Build: `scripts/build-mac.sh`.
