-- PR-4: long-term probe history
--
-- The original `launchops_health_snapshots` table is kept for backward
-- compatibility (it powers the live "is each project up right now?" view
-- on the landing page).
--
-- This new table is the canonical time-series log used to compute
-- uptime / p50 / p95 / p99 / error-rate over wider windows (24h, 7d, 30d)
-- and to feed the public `/api/public/projects/:slug/uptime` endpoint.
--
-- We keep it append-only and indexed by (project_slug, ts) so the typical
-- "give me everything for project X in the last 24h" query is a tight
-- range scan.

CREATE TABLE IF NOT EXISTS launchops_probe_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT NOT NULL,
  target       TEXT NOT NULL,
  ok           INTEGER NOT NULL,                    -- 0 / 1
  status       INTEGER,                             -- HTTP status, NULL on network error
  latency_ms   INTEGER,                             -- NULL on timeout
  ts           INTEGER NOT NULL,                    -- unix seconds
  source       TEXT NOT NULL DEFAULT 'cron'         -- 'cron' | 'opportunistic' | 'admin'
);

CREATE INDEX IF NOT EXISTS idx_probe_history_project_ts
  ON launchops_probe_history(project_slug, ts);

CREATE INDEX IF NOT EXISTS idx_probe_history_ts
  ON launchops_probe_history(ts);
