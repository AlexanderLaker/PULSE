/**
 * Sign-up page — Editorial design matching Trends 2 / Profit Pool Analysis 2.
 *
 * Mirrors app/sign-in/[[...sign-in]]/page.tsx — identical chrome so the
 * transition between sign-in and sign-up is seamless. The copy shifts to
 * request-access framing, and highlight tiles describe what the signer
 * is about to step into.
 *
 * Role assignment happens server-side via the Clerk webhook
 * (app/api/webhooks/clerk/route.ts) — first user in user_roles becomes
 * admin, everyone else viewer.
 */
import { SignUp } from '@clerk/nextjs';
import {
  Sparkles,
  BarChart3,
  Compass,
  Users,
} from 'lucide-react';

// ─── Editorial design tokens (identical to Trends2 / ProfitPoolAnalysis2) ──
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  surfaceHighest:     '#d2e4ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer: '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:  '#dae2fd',
  onTertiaryContainer:'#4a5167',
  outline:            '#477dbb',
  outlineVariant:     '#81b5f6',
  cardBorder:         'rgba(0, 52, 94, 0.10)',
  mutedText:          '#64748B',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const HIGHLIGHTS: Array<{
  icon: typeof Sparkles;
  title: string;
  copy: string;
  tone: { bg: string; fg: string };
}> = [
  {
    icon: Compass,
    title: 'Strategic War Room',
    copy: 'One surface for heatmap, path timeline, allocation and tipping points.',
    tone: { bg: S.primaryContainer, fg: S.onPrimaryContainer },
  },
  {
    icon: BarChart3,
    title: 'Bayesian by default',
    copy: '10K+ iterations, copula dependencies, convergence diagnostics.',
    tone: { bg: S.tertiaryContainer, fg: S.onTertiaryContainer },
  },
  {
    icon: Users,
    title: 'Built for teams',
    copy: 'Delphi elicitation, admin-managed roles, full audit trail.',
    tone: { bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  },
];

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: S.bg,
        color: S.onBg,
        fontFamily: BODY_FONT,
      }}
    >
      <main className="max-w-[1440px] mx-auto px-8 py-10 lg:py-16">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
          {/* ── Editorial brand panel ─────────────────────────────── */}
          <section className="order-2 lg:order-1">
            <div
              className="pl-5"
              style={{ borderLeft: `4px solid ${S.primary}` }}
            >
              <div
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: S.onSurfaceVariant }}
              >
                PRISM · Request Access
              </div>
              <h1
                className="font-extrabold tracking-tight"
                style={{
                  fontFamily: HEADLINE_FONT,
                  color: S.onBg,
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  lineHeight: 1.05,
                }}
              >
                Join the Profit Pool Shift Model
              </h1>
              <p
                className="mt-3 max-w-xl text-[15px]"
                style={{ color: S.onSurfaceVariant, lineHeight: 1.6 }}
              >
                Create an account to open the War Room and start working the
                82 trends, 12 categories, three horizons. Access is granted
                by the workspace administrator after sign-up.
              </p>
            </div>

            <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-2xl">
              {HIGHLIGHTS.map(({ icon: Icon, title, copy, tone }) => (
                <div
                  key={title}
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: S.surface,
                    boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-xl"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    <Icon size={18} strokeWidth={2.25} />
                  </span>
                  <div
                    className="mt-3 text-sm font-bold"
                    style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
                  >
                    {title}
                  </div>
                  <div
                    className="mt-1.5 text-xs leading-relaxed"
                    style={{ color: S.mutedText }}
                  >
                    {copy}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: S.onSurfaceVariant }}
            >
              <Sparkles size={12} />
              Confidential · Internal use only
            </div>
          </section>

          {/* ── Clerk sign-up card ────────────────────────────────── */}
          <section className="order-1 lg:order-2 w-full flex justify-center lg:justify-end">
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                backgroundColor: S.surface,
                boxShadow: '0 20px 80px -20px rgba(0, 52, 94, 0.18)',
              }}
            >
              <div
                className="px-8 py-5"
                style={{
                  backgroundColor: S.surfaceLow,
                  borderBottom: `1px solid ${S.cardBorder}`,
                }}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: S.onSurfaceVariant }}
                >
                  Create account
                </div>
                <div
                  className="mt-1 text-lg font-extrabold tracking-tight"
                  style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}
                >
                  Request workspace access
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
          </section>
        </div>
      </main>
    </div>
  );
}
