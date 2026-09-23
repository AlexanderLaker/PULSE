/**
 * POST /api/webhooks/clerk: Clerk's user events, mirrored into user_roles.
 * The route fails closed without its signing secret, refuses an event whose
 * Svix signature does not verify before anything reaches the role table, and
 * then adds, refreshes or removes the user's row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Webhook } from 'svix';

const SECRET = `whsec_${Buffer.from('a-test-signing-secret-of-some-length').toString('base64')}`;

const roles = vi.hoisted(() => ({
  upsertUserRole: vi.fn(async () => 'viewer'),
  deleteUserRole: vi.fn(async () => undefined),
}));
vi.mock('@/lib/roles', () => roles);

const incoming = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => incoming.headers }));

import { POST } from '@/app/api/webhooks/clerk/route';

/** A request as Clerk sends it: the body and the three Svix headers, signed with the secret. */
function signed(event: unknown, secret = SECRET): Request {
  const body = JSON.stringify(event);
  const id = 'msg_1';
  const at = new Date();
  incoming.headers = new Headers({
    'svix-id': id,
    'svix-timestamp': String(Math.floor(at.getTime() / 1000)),
    'svix-signature': new Webhook(secret).sign(id, at, body),
  });
  return new Request('https://prism.test/api/webhooks/clerk', { method: 'POST', body });
}

const created = {
  type: 'user.created',
  data: {
    id: 'user_7',
    primary_email_address_id: 'e2',
    email_addresses: [{ id: 'e1', email_address: 'old@example.com' }, { id: 'e2', email_address: 'Primary@Example.com' }],
  },
};

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;
  roles.upsertUserRole.mockClear();
  roles.deleteUserRole.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  vi.restoreAllMocks();
});

describe('/api/webhooks/clerk', () => {
  it('fails closed while the signing secret is unset', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    expect((await POST(signed(created))).status).toBe(500);
    expect(roles.upsertUserRole).not.toHaveBeenCalled();
  });

  it('refuses an event signed with another secret, or without the Svix headers', async () => {
    const forged = signed(created, `whsec_${Buffer.from('somebody-else').toString('base64')}`);
    expect((await POST(forged)).status).toBe(400);
    const request = signed(created);
    incoming.headers = new Headers();
    expect((await POST(request)).status).toBe(400);
    expect(roles.upsertUserRole).not.toHaveBeenCalled();
  });

  it('adds a new user with their primary address', async () => {
    expect((await POST(signed(created))).status).toBe(200);
    expect(roles.upsertUserRole).toHaveBeenCalledWith('user_7', 'Primary@Example.com');
  });

  it('removes a deleted user', async () => {
    expect((await POST(signed({ type: 'user.deleted', data: { id: 'user_7' } }))).status).toBe(200);
    expect(roles.deleteUserRole).toHaveBeenCalledWith('user_7');
  });

  it('answers 500 when the write fails, so Clerk sends the event again', async () => {
    roles.upsertUserRole.mockRejectedValueOnce(new Error('database down'));
    expect((await POST(signed(created))).status).toBe(500);
  });
});
