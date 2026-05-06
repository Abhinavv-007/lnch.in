# lnch.in

Public launch hub at `/` and the **LaunchOps** private command center at `/ops/*`,
all served from a single Vite + React + TypeScript app on Cloudflare Pages with
Pages Functions for the backend.

## Routes

- `/` — public landing (project cards, header, footer)
- `/ops/login` — admin login (secret + WebAuthn passkey)
- `/ops/dashboard` — composite ops dashboard
- `/ops/projects`, `/ops/projects/:slug`, `/ops/projects/:slug/:section`
- `/ops/github`, `/ops/deployments`, `/ops/cloudflare`, `/ops/vercel`
- `/ops/apis`, `/ops/logs`, `/ops/analytics`
- `/ops/changelogs`, `/ops/notes`, `/ops/tasks`, `/ops/incidents`
- `/ops/security`, `/ops/audit`, `/ops/settings`

All routes under `/ops/*` are gated by an HttpOnly `admin_session` cookie. The
client lib redirects to `/ops/login` on a 401.

## Stack

- **Frontend**: Vite, React 18, TypeScript (strict), Tailwind, lucide-react.
- **Backend**: Cloudflare Pages Functions (`functions/`), D1, KV.
- **Auth**: `LAUNCHOPS_ADMIN_SECRET` password gate + ES256 WebAuthn passkeys
  (adapted from the Modih Mail implementation, dependency-free).
- **Integrations**: GitHub REST, Cloudflare API, Vercel API, Firebase Admin
  (per-project service accounts via JWT → access token).

## Local development

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill in the values you want active
pnpm dev                         # vite only (frontend only)
pnpm dev:functions               # wrangler pages dev with Functions + D1 + KV
```

Run database migrations (the local D1 file lives under `.wrangler/`):

```bash
pnpm db:migrate:local
```

## Production setup

1. Create the D1 database and KV namespace:
   ```
   wrangler d1 create launchops-db
   wrangler kv namespace create LAUNCHOPS_KV
   ```
   Replace the placeholder IDs in `wrangler.toml` with the values printed.
2. Apply migrations:
   ```
   pnpm db:migrate:remote
   ```
3. Set secrets via `wrangler secret put` (or the Cloudflare Pages UI):
   ```
   LAUNCHOPS_ADMIN_SECRET   # required
   GITHUB_TOKEN
   CLOUDFLARE_API_TOKEN  CLOUDFLARE_ACCOUNT_ID  CLOUDFLARE_ZONE_ID
   VERCEL_TOKEN  VERCEL_TEAM_ID
   MODIH_ADMIN_SECRET
   FIREBASE_<MODIH|CLEX|CLEX_AI|DRIPED|TRGT|PORTFOLIO>_PROJECT_ID
   FIREBASE_<…>_CLIENT_EMAIL
   FIREBASE_<…>_PRIVATE_KEY    # PEM. literal \n sequences are decoded server-side
   ```
4. Deploy:
   ```
   pnpm deploy
   ```

## Security

- All third-party tokens stay server-side. The browser never sees them.
- Admin sessions are HttpOnly cookies stored in KV; revoke by deleting `sess:*`.
- Failed admin logins are rate-limited (5 / 5 min / IP) and audited.
- All write actions are written to `launchops_audit`.
- Passkeys are ES256 only (Apple/Android default). DER ECDSA → IEEE-P1363
  conversion and full clientDataJSON / authData validation happen server-side.

## Honest "missing integration" states

If a token isn't set the relevant `/ops` page shows a *Missing integration*
panel listing the env vars the operator needs to add. Nothing is faked — empty
states stay empty.
