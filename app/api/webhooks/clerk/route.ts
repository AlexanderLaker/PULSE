/**
 * POST /api/webhooks/clerk: Clerk's user events, mirrored into user_roles.
 *
 * Clerk calls this route when a user is created, updated or deleted, and the
 * role table in PRISM's database follows (lib/roles.ts): the first user ever
 * becomes admin, everyone after that viewer. A role granted to a new row, and
 * one removed with a deleted user, go to the audit log (lib/audit.ts).
 *
 * Every request is verified against CLERK_WEBHOOK_SIGNING_SECRET (Svix)
 * before the body is read; without the check anyone could forge a
 * user.created event. The route is public in proxy.ts because it
 * authenticates by signature, not by session.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { deleteUserRole, upsertUserRole } from '@/lib/roles';
import { recordRoleChange } from '@/lib/audit';

// Svix verifies with Node's crypto, and the Neon driver expects Node too.
export const runtime = 'nodejs';
// Every call is a unique signed request: never cache or pre-render it.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    // Fail closed: an unverified event must never reach user_roles.
    console.error('[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET not set');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  // Svix needs all three headers; a request without them is tampered or misrouted.
  const headerList = await headers();
  const svixId = headerList.get('svix-id');
  const svixTimestamp = headerList.get('svix-timestamp');
  const svixSignature = headerList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Verify the exact bytes Clerk signed: parsing first would re-serialise them.
  const payload = await req.text();

  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id } = event.data;
        // The primary address, else the first one.
        const primary =
          email_addresses.find((e) => e.id === primary_email_address_id) ??
          email_addresses[0];
        const email = primary?.email_address ?? '';
        if (!email) {
          console.warn(`[clerk-webhook] ${event.type} without email for ${id}`);
          break;
        }
        const { role, created } = await upsertUserRole(id, email);
        if (created) {
          await recordRoleChange({
            userId: id, from: null, to: role, via: `via the Clerk webhook (${event.type})`, actor: 'clerk-webhook',
          });
        }
        console.log(`[clerk-webhook] ${event.type}: ${id} is ${role}`);
        break;
      }

      case 'user.deleted': {
        const { id } = event.data;
        if (id) {
          const removed = await deleteUserRole(id);
          if (removed) {
            await recordRoleChange({
              userId: id, from: removed, to: null, via: 'via the Clerk webhook (user.deleted)',
              actor: 'clerk-webhook',
            });
          }
          console.log(`[clerk-webhook] user.deleted: ${id}`);
        }
        break;
      }

      default:
        // Other events are acknowledged so Clerk does not retry them.
        break;
    }
  } catch (err) {
    // A failed write answers 500, so Clerk retries with backoff.
    console.error('[clerk-webhook] handler error:', err);
    return NextResponse.json(
      { error: 'Handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
