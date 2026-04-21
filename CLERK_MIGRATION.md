# Clerk Auth Migration — Operator Runbook

**Target reader:** Alex (deployer). You have ~30 minutes of Clerk + Vercel + Neon dashboard work ahead of you. The repo side is done.

---

## Why we migrated

The old custom auth had real defects, not cosmetic ones:

- The `pulse_users` table had no `role` column, so admin vs viewer never worked end-to-end.
- A hardcoded `PRISM2026` keyword was visible in frontend JavaScript.
- Password-reset JWT signing used a fallback secret embedded in source.
- Logout only cleared the cookie — the JWT remained valid on other devices until expiry.
- No rate limiting, no MFA, no SSO.

Clerk gives us all of this out of the box. We keep authorization (admin/viewer) in our own Postgres, so audit log foreign keys stay intact and a future auth-provider swap is mechanical.

---

## Architecture of the new setup

```
┌──────────┐   sign-in     ┌───────┐   JWT cookie    ┌─────────────┐
│ Browser  │──────────────▶│ Clerk │────────────────▶│ Next.js app │
└──────────┘               └───┬───┘                 └──────┬──────┘
                               │ webhook                    │
                               │ (user.created etc)         │ reads role from
                               ▼                            ▼ Neon user_roles
                        ┌──────────────┐            ┌──────────────┐
                        │ /api/webhooks│─upserts───▶│ Neon Postgres│
                        │ /clerk       │            │ user_roles   │
                        └──────────────┘            └──────────────┘
```

- **Clerk** owns identity: email, password, sessions, MFA, SSO, password reset.
- **Neon Postgres `user_roles` table** owns authorization: `admin` vs `viewer`, keyed on Clerk user ID.
- **Webhook** keeps the two in sync: first user to sign up becomes admin automatically.

---

## Step 1 — Create a Clerk application

1. Go to <https://dashboard.clerk.com> and sign up (free tier covers everything we need).
2. **Create Application** → name it `PRISM` (or whatever you prefer).
3. Under **Email, Phone, Username**, enable **Email** (required) and leave the rest off.
4. Under **Authentication Strategies**, enable **Password** (and any SSO providers you want later — Google, Microsoft, etc.; not required now).
5. From **API Keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — starts with `pk_test_…` or `pk_live_…`
   - `CLERK_SECRET_KEY` — starts with `sk_test_…` or `sk_live_…`

> **Test vs live keys:** Clerk's test keys work with test email addresses only (`your+clerk_test@…`). For real sign-ups on the deployed URL, you'll eventually want **live** keys — but test keys are fine for the first deploy and a poke-around.

---

## Step 2 — Create the webhook in Clerk

1. In the Clerk dashboard: **Webhooks** → **Add Endpoint**.
2. **Endpoint URL:** `https://<your-vercel-domain>/api/webhooks/clerk`
   - For the preview deployment: `https://prism-2-<hash>-<project>.vercel.app/api/webhooks/clerk`
   - For production: use the stable domain assigned to the main branch.
3. **Message filtering** → subscribe to at minimum:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Save. Clerk shows a **Signing Secret** — starts with `whsec_…`. Copy it; you'll need it in Vercel.

> **Why we verify signatures:** the webhook is declared public in `middleware.ts` (no Clerk session cookie to check), so svix signature verification is the *only* thing stopping the internet from POSTing fake `user.created` events and auto-promoting attackers to admin.

---

## Step 3 — Configure Vercel environment variables

In the Vercel project **Settings → Environment Variables**, **add**:

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` from Clerk API keys | Production + Preview |
| `CLERK_SECRET_KEY` | `sk_test_…` from Clerk API keys | Production + Preview |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_…` from Clerk webhook | Production + Preview |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Production + Preview |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Production + Preview |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` | Production + Preview |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` | Production + Preview |

And **delete** (these are dead weight from the old auth):

- `JWT_SECRET`
- `PRISM_JWT_SECRET`
- `PRISM_BOOTSTRAP_ADMIN_EMAIL`
- `PRISM_BOOTSTRAP_ADMIN_PASSWORD`
- `PRISM_ACCESS_KEYWORD`
- `RESEND_API_KEY` (if present — was for password reset emails; Clerk handles this)
- `RESEND_FROM_EMAIL`

Keep `DATABASE_URL` (Neon) and `ANTHROPIC_API_KEY`.

---

## Step 4 — Verify Neon is connected

The webhook needs Neon to be reachable. You already set this up via **Vercel Storage → Create Database → Neon** (Frankfurt region) with the "Connect Project" flow, so `DATABASE_URL` should already be injected.

Double-check: **Settings → Environment Variables → filter "DATABASE_URL"** — should show for Production, Preview, and Development.

The `user_roles` table is created lazily on first request (see `lib/roles.ts`, `ensureUserRolesTable`). No manual migration needed.

---

## Step 5 — Trigger a deploy

Once the env vars are saved, Vercel will auto-redeploy on the next push (which we're about to do). If you want to redeploy the currently-latest build with the new env vars, go to **Deployments → … → Redeploy**.

---

## Step 6 — Smoke test (first sign-up = admin)

1. Open the deployed URL. You should be bounced to `/sign-in`.
2. Click **Sign up** → enter your email, password. Clerk sends a verification code.
3. Verify the email. You land on `/dashboard`.
4. In Neon's SQL editor (**Storage → your DB → SQL Editor**):
   ```sql
   SELECT clerk_user_id, email, role FROM user_roles;
   ```
   You should see exactly one row — yours — with `role = 'admin'`.
5. (Optional) Sign up a second test account with a different email. Confirm it gets `role = 'viewer'` in the same table.

If step 4 shows no row, the webhook didn't fire. Check:

- Clerk dashboard → **Webhooks** → your endpoint → **Message Attempts**. Failed attempts show the HTTP status and response body.
- Vercel **Logs** for `/api/webhooks/clerk` — the route logs `[clerk-webhook]` prefixed messages.

---

## Step 7 — Promote additional admins (when you need to)

Right now there's no UI for this. Run in Neon SQL editor:

```sql
UPDATE user_roles
   SET role = 'admin', updated_at = NOW()
 WHERE email = 'teammate@henkel.com';
```

A proper admin-management UI is a follow-up task. Until then, this SQL is the escape hatch.

---

## Deleting old data (optional cleanup)

The old auth tables (`pulse_users`, `pulse_password_resets`, etc) are dead weight in Neon. To drop them:

```sql
DROP TABLE IF EXISTS pulse_password_resets;
DROP TABLE IF EXISTS pulse_users;
```

I'd wait until after a successful smoke test before doing this, so you have a rollback option.

---

## Rollback plan

If something breaks and you need the old auth back:

1. `git revert` the Clerk migration commit.
2. Redeploy.
3. Re-add the old env vars (`JWT_SECRET`, etc.) from Vercel's env-var history (they keep deleted vars for a while) or from `.env.deploy`.

The Neon auth tables weren't dropped as part of the migration, so users + password hashes are still intact unless you ran the cleanup SQL above.

---

## What changed in the repo

**New files:**
- `middleware.ts` — Clerk session gate for all routes.
- `lib/roles.ts` — `user_roles` table CRUD, `requireAuth` / `requireAdmin` helpers.
- `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx` — Clerk hosted UI.
- `app/api/webhooks/clerk/route.ts` — svix-verified user sync.
- `CLERK_MIGRATION.md` — this document.

**Rewritten:**
- `app/layout.tsx` — wrapped in `<ClerkProvider>` with editorial theming.
- `app/page.tsx` — now a server redirect to `/dashboard`; middleware handles the signed-out case.
- `app/dashboard/page.tsx` — uses `useUser()` / `useClerk()` instead of `fetch('/api/auth/check')`.
- `lib/auth.ts` — now a compat shim re-exporting Clerk helpers + `lib/roles`.
- `lib/db.ts` — stripped of user CRUD; just exports `getSQL()`.
- `lib/users.ts` — gutted to `export {};` (kept to fail loud if anything still imports it).
- `package.json` — added `@clerk/nextjs`, `svix`; removed `jose`, `bcryptjs`, `@types/bcryptjs`.
- `package-lock.json` — regenerated.

**Retired with stubs** (kept as redirects / 410 Gone so stale clients and bookmarks fail cleanly):
- `app/login`, `app/register`, `app/forgot-password`, `app/reset-password` → redirect to Clerk equivalents.
- `app/api/auth/{check,login,logout,refresh,register,forgot-password,reset-password}` → return 410 with an explanatory message.

These stubs can be deleted outright in a follow-up once we're confident nothing still calls them. They exist as stubs now because the sandbox blocked filesystem deletion at migration time; `git rm` via a local checkout is the simplest path.

---

## Open follow-ups (not blocking)

- [ ] Delete the redirect stub files (`git rm -r app/login app/register app/forgot-password app/reset-password app/api/auth/{check,login,logout,refresh,register,forgot-password,reset-password}`) once smoke test passes.
- [ ] Build an in-app admin UI to promote/demote users instead of running SQL.
- [ ] Drop the old `pulse_users` / `pulse_password_resets` tables from Neon.
- [ ] Switch Clerk keys from test to live before real users sign up.
- [ ] Wire Clerk SSO (Google / Microsoft) for the Henkel tenant if desired.
