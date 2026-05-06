# lnch.in / LaunchOps — full deploy playbook

This is the end-to-end checklist to take this repo from "merged PR" to a live
site at **`https://lnch.in`** with the LaunchOps console at **`https://lnch.in/ops`**.

You only do this once per environment. After that, every push to `main` will
auto-deploy through Cloudflare Pages.

---

## 0. Prerequisites (one-time, on your laptop)

Install the tools you'll use to operate Cloudflare from the CLI:

```bash
node -v          # >= 20
corepack enable  # so pnpm is available
pnpm -v          # any 9.x

npm i -g wrangler@latest
wrangler --version

git clone https://github.com/Abhinavv-007/lnch.in.git
cd lnch.in
pnpm install
wrangler login   # opens a browser, links wrangler to your Cloudflare account
```

Make sure the Cloudflare account you log into is the one that will host
`lnch.in`. You'll need:

- API access (you already have it once you `wrangler login`)
- DNS for `lnch.in` either on Cloudflare or proxiable to it
- Permissions to create D1, KV, Pages projects

---

## 1. Create the D1 database

```bash
wrangler d1 create launchops-db
```

Wrangler prints a block like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "launchops-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` and paste it into `wrangler.toml`, replacing
`00000000-0000-0000-0000-000000000000`.

## 2. Create the KV namespace

```bash
wrangler kv namespace create LAUNCHOPS_KV
```

Wrangler prints:

```toml
[[kv_namespaces]]
binding = "LAUNCHOPS_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Copy `id` and paste it into `wrangler.toml`, replacing the placeholder
`0000000000000000000000000000000000`.

Commit those two ID changes:

```bash
git add wrangler.toml
git commit -m "Wire production D1 + KV bindings"
git push
```

> If you'd rather not commit the IDs, you can keep them in a local
> `wrangler.local.toml` (already gitignored) and use
> `wrangler --config wrangler.local.toml ...`. Recommended only if the IDs are
> sensitive to you. They aren't secrets — they're just identifiers.

## 3. Apply the database schema

```bash
pnpm db:migrate:remote
```

This runs `migrations/0001_init_launchops.sql` against the production D1 DB:
passkeys, audit log, notes, tasks, incidents, changelog drafts, health
snapshots, settings.

(Optionally seed one starter task: `pnpm db:seed:remote`.)

## 4. Create the Cloudflare Pages project

You can do this either via the dashboard or the CLI. The dashboard route is
simpler for the first deploy because it sets up the GitHub integration.

### Dashboard route (recommended)

1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the `Abhinavv-007/lnch.in` repo, branch `main`.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `pnpm install && pnpm build`
   - Build output directory: `dist`
   - Root directory: *(leave blank)*
4. Click **Save and deploy**. The first build will run.

### CLI route (alternative)

```bash
pnpm build
wrangler pages deploy dist --project-name=lnch-in
```

## 5. Bind D1 + KV to the Pages project

This is the step that 99% of people miss. The Pages **runtime** needs the same
bindings the local Wrangler config defines.

In **Cloudflare dashboard → Workers & Pages → lnch-in → Settings → Functions**:

- **D1 database bindings:**
  - Variable name: `DB`
  - Database: `launchops-db`
- **KV namespace bindings:**
  - Variable name: `LAUNCHOPS_KV`
  - Namespace: `LAUNCHOPS_KV` (the one you created in step 2)

Add them for **both** "Production" and "Preview" environments.

## 6. Set environment variables / secrets

In **Cloudflare dashboard → Workers & Pages → lnch-in → Settings → Environment Variables**, add the following. Mark anything sensitive as **Encrypted**.

### Required for auth to work at all

| Name | Value | Encrypted? |
|---|---|---|
| `LAUNCHOPS_ADMIN_SECRET` | a long random string you generate | ✅ |
| `LAUNCHOPS_RP_ID` | `lnch.in` | no |
| `LAUNCHOPS_RP_ORIGIN` | `https://lnch.in` | no |

> The `RP_ID` / `RP_ORIGIN` pair is what binds passkeys to your domain. Set
> `RP_ID = lnch.in` so registered passkeys also work on subdomains. Do **not**
> include `https://` in `RP_ID`. The `RP_ORIGIN` does include the scheme.

To generate a strong admin secret on the CLI:

```bash
openssl rand -base64 48
```

### Optional integrations (each one unlocks its own UI)

| Name | What it unlocks | Where to get it |
|---|---|---|
| `GITHUB_TOKEN` | repo / commits / PR / workflow data | GitHub → Settings → Developer settings → Personal access tokens (fine-grained, read-only on `Abhinavv-007/*` repos) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare account / Pages / Workers / D1 / KV / zones | Cloudflare → My Profile → API Tokens → Create Token. Permissions: Account → Pages: Read, Workers Scripts: Read, Workers KV: Read, D1: Read, Account Settings: Read; Zone → Zone: Read, DNS: Read |
| `CLOUDFLARE_ACCOUNT_ID` | required alongside the token | Cloudflare → any zone overview, right column |
| `CLOUDFLARE_ZONE_ID` | for zone listings | Cloudflare → `lnch.in` → overview, right column |
| `VERCEL_TOKEN` | Vercel projects + deployments | Vercel → Account Settings → Tokens |
| `VERCEL_TEAM_ID` | only if using a team | Vercel team settings |
| `MODIH_ADMIN_SECRET` | Modih admin endpoints | from your Modih Mail Pages env |

### Per-project Firebase (one tuple per project — only what you have)

For each of: `MODIH`, `CLEX`, `CLEX_AI`, `DRIPED`, `TRGT`, `PORTFOLIO`:

| Name | Value |
|---|---|
| `FIREBASE_<SLUG>_PROJECT_ID` | from the service-account JSON |
| `FIREBASE_<SLUG>_CLIENT_EMAIL` | from the service-account JSON |
| `FIREBASE_<SLUG>_PRIVATE_KEY` | the **PEM** value, line breaks encoded as literal `\n` |

The `\n` encoding is the standard "JSON-string" form. The server decodes the
sequence back to real newlines. Don't paste the full multi-line PEM directly
into the env-var field.

> Service-account JSONs **never** go into the repo. They live as env vars on
> Cloudflare Pages, and only on Cloudflare Pages. Pages encrypts them at rest.

When you're done with secrets, redeploy so the build picks them up:

- In the Pages dashboard, **Deployments → Retry deployment** on the latest
  build (or push any commit to `main`).

## 7. Wire up DNS

In **Cloudflare → `lnch.in` zone → DNS**, add either:

- **CNAME** `@` (or `lnch.in`) → `<your-pages-project>.pages.dev`, **proxied**
- or use Cloudflare Pages → lnch-in → **Custom domains → Set up custom domain**
  and let it create the records for you (this is the easier path).

Custom-domain setup propagates in a few minutes. Once it goes green,
`https://lnch.in` serves the public landing.

## 8. First admin login + passkey

1. Open `https://lnch.in/ops/login` in **the browser you actually want to use as your admin device** (passkeys are bound to that browser/OS keychain).
2. Paste `LAUNCHOPS_ADMIN_SECRET`. You should land on `/ops/dashboard`.
3. Go to `/ops/security`. Click **Register passkey**, label it (e.g. *MacBook Touch ID*).
4. Sign out via the topbar. Sign back in using the **Use passkey** button.
5. Repeat the register/login flow on any second device you want (e.g. your phone) so you have at least 2 passkeys. If you ever lose one, use the other to remove the lost one from `/ops/security`.

## 9. Smoke-test the integrations

Once secrets are set:

- `/ops/dashboard` should show stat cards with real numbers (commits, deployments, etc.).
- `/ops/github` should list recent commits across all 6 repos.
- `/ops/cloudflare` should show your account and your Pages projects.
- `/ops/vercel` should show projects (only if `VERCEL_TOKEN` is set).
- `/ops/analytics` should show per-project Firebase user counts (only for projects whose Firebase tuple is set).
- `/ops/audit` should already have several entries (your login, passkey register, etc.).

Anywhere a token isn't set, the page shows a **Missing Integration** card listing exactly which env vars to add. That's by design — there are no fake numbers anywhere.

## 10. Day-2 ops

- **Push to `main`** → Pages auto-builds and auto-deploys. Branch deploys get preview URLs and use the *Preview* env-var set, so you can use a separate `LAUNCHOPS_ADMIN_SECRET` for previews.
- **Add a new admin device** → log in on it once with the secret, register a passkey, you're set.
- **Rotate the admin secret** → set the new value, redeploy. Existing sessions stay valid until they expire (14 days) or you flush KV: `wrangler kv key delete --binding=LAUNCHOPS_KV "sess:<token>"` (or just delete all `sess:*` keys to log everyone out).
- **Rotate a leaked GitHub / Vercel / CF token** → revoke at the provider, set new value in Pages env, redeploy.
- **Read audit log** → `/ops/audit` (200 most recent), or query D1 directly: `wrangler d1 execute launchops-db --remote --command "SELECT * FROM launchops_audit ORDER BY ts DESC LIMIT 50;"`.
- **Schema changes** → add a new `migrations/0002_*.sql`, run `pnpm db:migrate:remote`.

## 11. Common gotchas

- **Passkey "not allowed" error.** `LAUNCHOPS_RP_ID` doesn't match your domain. Set `RP_ID = lnch.in`, **redeploy**, register passkey **after** the redeploy.
- **Login works locally but not in production.** D1/KV bindings missing in the Pages project's runtime settings (step 5).
- **`/api/ops/*` returns 401.** Your session cookie expired. Sign in again at `/ops/login`.
- **`/ops/cloudflare` says missing integration even though token is set.** The token needs `Account Settings: Read` plus the Pages/Workers/D1/KV/Zone read permissions; without `Account Settings: Read`, even `tokens/verify` fails.
- **Firebase user count returns null.** The service account is missing the `Firebase Authentication Admin` role on that Firebase project, or the project has more than 1000 users (Identity Toolkit pages above 1000 — currently the adapter just queries one page). If you need exact counts at scale we can swap to the Firestore admin API or paginate.
- **Build fails: "Cannot find module './styles/globals.css'".** Re-run `pnpm install`. The `src/vite-env.d.ts` `*.css` declaration must be present.

## 12. Quick reference

```bash
# Local dev
pnpm dev               # frontend only (no Functions)
pnpm dev:functions     # frontend + Cloudflare Pages Functions via wrangler

# Quality gates
pnpm lint
pnpm typecheck
pnpm build

# Database
pnpm db:migrate:local
pnpm db:migrate:remote
pnpm db:seed:local
pnpm db:seed:remote

# Deploy (the Pages git integration handles this for you on push to main)
pnpm deploy
```

That's it. Once steps 1–8 are done, the rest is just "push code to `main`".
