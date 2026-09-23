# 0012. Identity in Clerk, roles in PRISM, tokens between them

Status: accepted

## Context

Sign-in, sessions, password reset and multi-factor authentication are a
product of their own. What a user may do in PRISM is PRISM's business, and it
should sit next to the audit log it is written to.

## Decision

- Clerk owns identity. The role (admin or viewer) lives in PRISM's database
  (`user_roles`); a Clerk webhook, verified by its signature, adds a row at
  sign-up, as admin when the table is empty (the first user).
- The API never sees a Clerk session. It verifies HS256 tokens that the
  dashboard's server routes sign for the signed-in user and that expire
  (after thirty minutes for reads, five minutes for admin writes).
- Reads and a user's own expert proposals use an httpOnly cookie scoped to
  `/api/v1` that always carries the viewer role. Admin writes go through a
  dashboard route that checks the role and forwards the request with a
  five-minute admin token carrying the user's identity, which the API writes
  to its audit log. Signing out expires the cookie first.

## Consequences

The browser can never hold a token that authorises an admin write. Replacing
Clerk touches the dashboard (`proxy.ts`, the provider in `app/layout.tsx`,
the auth helpers, the sign-in pages, the webhook, the user menu and list, and
the account and session settings), not the API or the roles.
