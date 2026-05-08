/**
 * Server-side uptime clamp.
 *
 * Public surface never displays "100.00%" — Cloudflare's own platform SLO
 * is 99.99%, so anything we serve via Pages cannot beat that. We clamp the
 * displayed window-uptime to [0, 99.99] with a soft floor of 99.5 when the
 * underlying availability rounds to 100. Sub-99.5 values pass through
 * untouched so the public surface stays honest about real outages.
 *
 * Mirror of the client-side helper in `src/lib/format.ts` so the API
 * doesn't depend on the client bundle.
 */
export function clampUptimeServer(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct >= 99.99) return 99.99;
  if (pct >= 99.5) return Math.min(pct, 99.99);
  return Math.max(0, pct);
}
