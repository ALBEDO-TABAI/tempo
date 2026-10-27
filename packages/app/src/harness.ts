// Test/parity hooks, enabled only by URL query (?harness=1). Never active in normal launches.
export const Q = new URLSearchParams(location.search);
export const HARNESS = Q.get('harness') === '1';
if (HARNESS && Q.get('now')) {
  const base = Date.parse(Q.get('now')!); const t0 = performance.now(); const frozen = Q.get('freeze') === '1';
  Date.now = () => (frozen ? base : base + (performance.now() - t0));
}
