# Tempo — progress (resumable)
Recreation of a desktop calendar (reference: Notion Calendar 1.132.0) under our own brand. Research lives in /workspace/ncal-research (SPEC.md, RE_NOTES.md, tokens/, ref/).
Rules: original code only; no upstream strings/logos/icons/fonts; values & behaviour may match. Do not push.

## Done
- tokens pipeline: scripts/import-tokens.mjs (research dumps → packages/tokens/src/tokens.json, prefix renamed to --tp-), packages/tokens/build.mjs → generated/tokens.css + tokens.ts; scale.json holds type scale, chip metrics, grid + interaction constants (SPEC §3–5).
- core: dates.ts (day numbers), tz.ts (Intl-based zone conversion, DST gap/overlap handling).

## Next
- core: rrule.ts, ics.ts, model.ts, layout.ts, color.ts + vitest
- live capture (白 signed in 01:50 JST) → ncal-research/ref
- app (React/Vite), desktop (Electron), parity harness, build-mac.sh
