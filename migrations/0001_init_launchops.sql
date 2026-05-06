-- LaunchOps initial schema.
-- All tables are owned by the LaunchOps admin layer; nothing here is exposed
-- to unauthenticated users.

CREATE TABLE IF NOT EXISTS launchops_passkeys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,                 -- always 'admin' today; reserved for future multi-user
  cred_id     TEXT NOT NULL UNIQUE,          -- base64url credential id
  jwk         TEXT NOT NULL,                 -- JSON of the EC2 P-256 public key
  sign_count  INTEGER NOT NULL DEFAULT 0,
  label       TEXT,
  created_at  INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS launchops_audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  actor  TEXT,                              -- 'admin', 'system', 'unknown'
  action TEXT NOT NULL,                     -- 'auth.login.ok', 'task.create', etc.
  target TEXT,
  ip     TEXT,
  meta   TEXT                               -- JSON payload
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON launchops_audit(ts);

CREATE TABLE IF NOT EXISTS launchops_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  tags         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_project ON launchops_notes(project_slug);

CREATE TABLE IF NOT EXISTS launchops_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT,
  title        TEXT NOT NULL,
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'open',  -- open|blocked|shipped|archived
  priority     INTEGER NOT NULL DEFAULT 2,    -- 1=urgent, 2=normal, 3=later
  tags         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON launchops_tasks(status, priority);

CREATE TABLE IF NOT EXISTS launchops_changelog_drafts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft', -- draft|published|archived
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changelogs_project ON launchops_changelog_drafts(project_slug);

CREATE TABLE IF NOT EXISTS launchops_incidents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT,
  title        TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'minor',
  status       TEXT NOT NULL DEFAULT 'open',  -- open|monitoring|resolved
  notes        TEXT,
  opened_at    INTEGER NOT NULL,
  resolved_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON launchops_incidents(status);

CREATE TABLE IF NOT EXISTS launchops_health_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT NOT NULL,
  target       TEXT NOT NULL,
  ok           INTEGER NOT NULL,
  status       INTEGER,
  latency_ms   INTEGER,
  ts           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_project_ts ON launchops_health_snapshots(project_slug, ts);

CREATE TABLE IF NOT EXISTS launchops_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
