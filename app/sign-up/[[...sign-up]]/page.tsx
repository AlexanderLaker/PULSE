/**
 * Sign-up page — minimal, neutral surface.
 *
 * Mirrors app/sign-in/[[...sign-in]]/page.tsx. Reveals nothing about the
 * application: no product name, taxonomy, scope or marketing copy. The
 * editorial tokens (maritime blue, Manrope + Inter, paper card, soft
 * tonal shadow) stay consistent with Trends 2 / Profit Pool Analysis 2.
 *
 * Role assignment happens server-side via the Clerk webhook
 * (app/api/webhooks/clerk/route.ts) — first user in user_roles becomes
 * admin, everyone else viewer.
 */
import { SignUp } from '@clerk/nextjs';

// ─── Editorial design tokens (identical to Trends2 / ProfitPoolAnalysis2) ──
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  primary:            '#005db5',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        backgroundColor: S.bg,
        color: S.onBg,
        fontFamily: BODY_FONT,
      }}
    >
      <div className="w-full max-w-md">
        {/* Small brand mark — just a tonal square, no wordmark */}
        <div className="flex justify-center mb-8">
          <div
            className="rounded-2xl"
            style={{
              width: 48,
              height: 48,
              backgroundColor: S.primary,
              boxShadow: '0 10px 30px -10px rgba(0, 93, 181, 0.55)',
            }}
          />
        </div>

        {/* Sign-up card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: S.surface,
            boxShadow: '0 20px 80px -20px rgba(0, 52, 94, 0.18)',
          }}
        >
          <div
            className="px-8 py-6 text-center"
            style={{
              backgroundColor: S.surfaceLow,
              borderBottom: `1px solid ${S.cardBorder}`,
            }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: S.onSurfaceVariant }}
            >
              Request access
            </div>
            <div
              className="mt-1 text-xl font-extrabold tracking-tight"
              style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
            >
              Create account
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 sm:py-8 flex justify-center">
            <SignUp
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none bg-transparent p-0 w-full',
                  header: 'hidden',
                },
              }}
            />
          </div>
        </div>

        <div
          className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: S.onSurfaceVariant }}
        >
          Authorised users only
        </div>
      </div>
    </div>
  );
}
