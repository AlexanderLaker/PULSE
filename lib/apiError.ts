/**
 * One readable line from an error body: `detail` from the API, `error` from
 * the dashboard's own routes. The browser client (lib/apiClient.ts) and the
 * server routes that forward admin writes (lib/backend.ts) both read errors
 * through it, so a refusal reads the same wherever it surfaces. FastAPI's
 * validation errors arrive as a list of {loc, msg}, which would otherwise
 * render as "[object Object]".
 *
 * Null when the body says nothing readable; the caller adds its own fallback.
 */
export function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { detail?: unknown; error?: unknown };
  const detail = b.detail ?? b.error;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      const rec = item as { loc?: unknown; msg?: unknown };
      const loc = (Array.isArray(rec.loc) ? rec.loc : []).filter((l) => l !== 'body').join('.');
      const msg = typeof rec.msg === 'string' ? rec.msg : JSON.stringify(item);
      return loc ? `${loc}: ${msg}` : msg;
    });
    return parts.length ? parts.join('; ') : null;
  }
  if (detail && typeof detail === 'object') {
    const nested = (detail as { error?: unknown }).error;
    return typeof nested === 'string' ? nested : JSON.stringify(detail);
  }
  return detail != null ? String(detail) : null;
}
