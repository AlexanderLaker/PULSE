# PRISM — Deployment Notes

## JWT secret synchronization

The Next.js frontend and the Python FastAPI backend both sign and verify JWTs,
but they read the secret from **different environment variables**:

| Component | Variable | Read in |
|-----------|----------|---------|
| Next.js   | `JWT_SECRET`        | `lib/auth.ts` |
| FastAPI   | `PRISM_JWT_SECRET`  | `pulse/api/auth.py` |

**Both variables MUST be set to the same value** in every environment:

- Local development — `.env`
- Vercel — Environment Variables dashboard (Production, Preview, Development)

If the values diverge, the HMAC signature check on the Python side fails and
every authenticated request returns `401 Invalid or expired token` — even when
the token is valid from the Next.js side.

### Generating a secret

Use a random 64-character value (minimum 32 chars enforced at import):

```bash
# Node
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"

# Python
python -c 'import secrets; print(secrets.token_urlsafe(64))'
```

**Never hardcode the secret in the codebase.** Set it via environment only.

### Rotating the secret

Rotating the secret invalidates all active sessions. Users must re-login once.
Rotate both `JWT_SECRET` and `PRISM_JWT_SECRET` at the same time so they stay
in sync.
