-- Optional seed: a "first task" the operator can use to verify the LaunchOps
-- task list reaches D1. Idempotent: only inserts if no tasks exist yet.

INSERT INTO launchops_tasks (project_slug, title, body, status, priority, tags, created_at, updated_at)
SELECT NULL, 'Set up secrets in Cloudflare Pages', 'Add LAUNCHOPS_ADMIN_SECRET, GITHUB_TOKEN, CLOUDFLARE_API_TOKEN, VERCEL_TOKEN, MODIH_ADMIN_SECRET and the FIREBASE_* tuples per project.', 'open', 1, 'setup',
       strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM launchops_tasks);
