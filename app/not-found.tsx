/**
 * The page for an address PRISM does not have. It renders per request
 * (connection() opts it out of prerendering), so it carries the request's
 * nonce and its scripts run under the Content Security Policy of proxy.ts;
 * a prerendered page would ship script tags without one, and the policy
 * would then block them. It uses the frame of the sign-in pages, drawn here
 * because this file sits outside their route group.
 */
import Link from 'next/link';
import { connection } from 'next/server';
import { CardHeading } from '@/app/(auth)/shared';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';

export default async function NotFound() {
  await connection();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <div className="mb-10 text-2xl font-extrabold tracking-tighter uppercase" style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}>
        PRISM
      </div>
      <main
        className="w-full max-w-md rounded-3xl text-center"
        style={{ backgroundColor: S.surface, boxShadow: SHADOW.authCard, padding: '40px 32px 32px' }}
      >
        <CardHeading label="Not found" title="There is no page at this address">
          The dashboard lives at one address, with the view in the query string.
        </CardHeading>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold"
          style={{ backgroundColor: S.primary, color: S.onPrimary, fontFamily: HEADLINE_FONT, minHeight: 40 }}
        >
          Go to the dashboard
        </Link>
      </main>
    </div>
  );
}
