-- PR-2 follow-up: public-API audit log
--
-- We already have:
--   * launchops_audit             — ops/admin actions (small, low-write)
--   * launchops_health_snapshots  — current "is project up?" view
--   * launchops_probe_history     — long-term probe time-series
--
-- What we're missing is a record of every public-API call (anonymous, IP-keyed)
-- so that the /ops "APIs" tab can show a true cross-project consumer view:
--   * which IPs are hitting the public surface today
--   * which endpoints they're hitting (heatmap, commits, search, ...)
--   * how the load is spread across projects
--   * how it's spread over time (per-hour, last 7 days)
--
-- Mixing this into launchops_audit would explode the row count and make the
-- ops audit log unreadable, so it lives in its own table with its own pruning
-- policy (the cron sweeper trims rows older than 30 days on every run).

CREATE TABLE IF NOT EXISTS launchops_public_audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,                  -- unix seconds
  ip           TEXT NOT NULL,                     -- raw client IP from CF / x-forwarded-for; NEVER hashed because /ops needs to identify abusers and the data is privately gated
  method       TEXT NOT NULL,                     -- 'GET' | 'POST' | ...
  path         TEXT NOT NULL,                     -- '/api/public/projects/clex/heatmap'
  endpoint     TEXT NOT NULL,                     -- normalized: '/api/public/projects/:slug/heatmap'
  project_slug TEXT,                              -- 'clex' | NULL when path isn't project-scoped
  status       INTEGER NOT NULL,                  -- HTTP status returned to the caller
  latency_ms   INTEGER,                           -- end-to-end ms inside the function
  rl_used      INTEGER,                           -- ratelimit counter at the time of this call
  rl_limit     INTEGER,                           -- the budget that applied
  ua_short     TEXT                               -- first 80 chars of user-agent, useful for spotting bots
);

CREATE INDEX IF NOT EXISTS idx_public_audit_ts
  ON launchops_public_audit(ts);

CREATE INDEX IF NOT EXISTS idx_public_audit_ip_ts
  ON launchops_public_audit(ip, ts);

CREATE INDEX IF NOT EXISTS idx_public_audit_project_ts
  ON launchops_public_audit(project_slug, ts);

CREATE INDEX IF NOT EXISTS idx_public_audit_endpoint_ts
  ON launchops_public_audit(endpoint, ts);
