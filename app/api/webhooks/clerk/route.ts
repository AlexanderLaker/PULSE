/**
 * Clerk webhook receiver.
 *
 * Clerk POSTs here whenever a user-lifecycle event happens
 * (user.created, user.updated, user.deleted). We mirror the event
 * into PRISM's `user_roles` table so authorization logic — which
 * runs in our own Postgres, not Clerk — stays in sync.
 *
 * Security model
 * --------------
 * Svix signs every webhook with a shared secret (CLERK_WEBHOOK_SIGNING_SECRET).
 * Without verification, anyone on the internet could forge "user.created"
 * requests and auto-promote themselves to admin. We verify the signature
 * before parsing the body — failures return 400 and log nothing sensitive.
 *
 * Route is declared public in middleware.ts (`/api/webhooks/(.*)`) because
 * it authenticates via svix, not via a Clerk session cookie.
 *
 * First-user-admin rule
 * ---------------------
 * `upsertUserRole` in lib/roles.ts counts existing rows; if zero, the new
 * user is admin. This gives Alex admin without needing manual SQL after
 * the first sign-up. The race window (two people signing up in the same
 * second) is effectively nil for an internal tool, and the worst case is
 * two admins — trivial to fix.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { deleteUserRole, upsertUserRole } from '@/lib/roles';

// Pin to the Node runtime — svix needs Node's `crypto` for HMAC verification
// and the Neon driver used by upsertUserRole expects a Node environment.
// Edge runtime would fail on both counts.
export const runtime = 'nodejs';

// Webhooks must never be statically optimized or cached; every invocation
// is a unique signed request from Clerk.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    // Fail closed: if the deployer forgot to set the secret, we must
    // not accept unverified events — otherwise the endpoint becomes a
    // backdoor into user_roles.
    console.error('[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET not set');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  // Svix requires all three headers to verify. Missing any → tampered
  // or misrouted request; reject with 400.
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

  // Read the raw body as text — svix verifies against the exact bytes
  // Clerk signed. Parsing to JSON first would re-serialize and break
  // the signature check.
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

  // At this point the payload is authentic. Dispatch on event type.
  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id } = event.data;
        // Pick the primary email if marked, otherwise fall back to
        // the first address. Clerk guarantees at least one.
        const primary =
          email_addresses.find((e) => e.id === primary_email_address_id) ??
          email_addresses[0];
        const email = primary?.email_address ?? '';
        if (!email) {
          console.warn(`[clerk-webhook] ${event.type} without email for ${id}`);
          break;
        }
        const role = await upsertUserRole(id, email);
        console.log(`[clerk-webhook] ${event.type}: ${email} → ${role}`);
        break;
      }

      case 'user.deleted': {
        const { id } = event.data;
        if (id) {
          await deleteUserRole(id);
          console.log(`[clerk-webhook] user.deleted: ${id}`);
        }
        break;
      }

      default:
        // Clerk sends other events (session.created, email.created, …)
        // that we don't care about. Ack them so Clerk doesn't retry.
        break;
    }
  } catch (err) {
    // Persistence failed (DB down, migration missing, etc). Return 500
    // so Clerk will retry with exponential backoff — this is the right
    // behavior for transient errors.
    console.error('[clerk-webhook] handler error:', err);
    return NextResponse.json(
      { error: 'Handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
