# 0012. Identity in Clerk, roles in PRISM, tokens between them

Status: accepted

## Context

Sign-in, sessions, password reset and multi-factor authentication are a
product of their own. What a user may do in PRISM is PRISM's business, and it
should sit next to the audit log it is written to. PRISM holds confidential
judgment, so an account alone must open nothing.

## Decision

- Clerk owns identity and decides who may create an account (sign-up
  restricted to invited addresses or an allowlist). The role (admin or
  viewer) lives in PRISM's database (`user_roles`). A user who signs up gets
  no row: they are pending until an admin gives them a role in Settings,
  which adds it, and an admin can take it away again. Each such change is
  conditional and serialisable, so PRISM always keeps an admin. While
  `PRISM_ALLOWED_EMAIL_DOMAINS` is set, only an address at one of its
  domains can be approved. A Clerk webhook, verified by its signature, keeps
  a known user's email current and removes a deleted user's row. The first
  admin of a new database is made once, with a shared secret, for the
  address named in `ADMIN_BOOTSTRAP_EMAIL`; once an admin exists, that route
  refuses.
- The role is checked before the dashboard page renders, in `proxy.ts`,
  because a redirect from inside a page would still send the page's script
  addresses; the page checks again and hands the dashboard its role. A
  pending user gets a waiting page of its own, which carries none of the
  dashboard's code.
- The API never sees a Clerk session. It verifies HS256 tokens that the
  dashboard's server routes sign for a user with a role and that expire
  (after thirty minutes for reads, five minutes for admin writes).
- Reads and a user's own expert proposals use an httpOnly cookie scoped to
  `/api/v1` that always carries the viewer role. Admin writes go through a
  dashboard route that checks the role and forwards the request with a
  five-minute admin token carrying the user's identity, which the API writes
  to its audit log. Signing out expires the cookie first.

## Consequences

The browser can never hold a token that authorises an admin write, and an
account no admin has approved gets no token and is never told where the
dashboard's code is. The content built into that code stays readable to
anyone who has its addresses, a user whose role was taken away among them,
until it moves behind the API. A role taken away ends admin writes at once
and reads within thirty minutes, when the cookie runs out, because the API
checks the token, not the role. Replacing Clerk touches the dashboard
(`proxy.ts`, the provider in `app/layout.tsx`, the auth helpers, the
sign-in, sign-up and waiting pages, the webhook, the user menu and list, and
the account and session settings), not the API or the roles.
