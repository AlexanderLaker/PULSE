import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * R-17 (design review 2026-07-01): Manrope / Inter / JetBrains Mono are now
 * actually shipped — self-hosted at build time via next/font (no runtime
 * Google request), exposed as CSS variables consumed by lib/theme.ts.
 * `adjustFontFallback` (default) generates size-adjusted fallbacks so the
 * pre-font paint matches closely and dense layouts don't jump.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'PRISM Profit Pool Shift Model',
  description: 'Profit Pool Simulation Engine — Strategic FMCG Analysis',
};

// R-24: browser/OS chrome colour matches the deep-navy brand.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00345E',
};

/**
 * Clerk `appearance` config is the single source of visual truth for
 * every element Clerk renders — SignIn, SignUp, UserButton, UserProfile,
 * factor-one, verify-email, etc. We bend it to match the editorial
 * design system used by Trends 2 / Profit Pool Analysis 2:
 *   • Maritime blue palette (`#005db5` primary, `#00345e` on-surface)
 *   • Pill-shaped primary buttons (fully rounded)
 *   • Manrope for headings, Inter for body
 *   • Soft tonal accents, no harsh 1px borders
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          // Editorial palette — identical tokens to Trends2 / ProfitPoolAnalysis2
          colorPrimary: '#005db5',
          colorText: '#00345e',
          colorTextSecondary: '#26619d',
          colorBackground: '#ffffff',
          colorInputBackground: '#eff4ff',
          colorInputText: '#00345e',
          colorNeutral: '#00345e',
          colorDanger: '#9f403d',
          colorSuccess: '#15803d',
          colorWarning: '#b45309',
          fontFamily:
            "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
          fontFamilyButtons:
            "var(--font-manrope), 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '14px',
          // NOTE: keep this modest. A fully-rounded global radius (e.g. 9999px)
          // gets applied to Clerk's card/main containers — and when the
          // container is roughly square, it renders as a perfect circle
          // (the "lens" bug). Pill-shaped CTAs are handled individually via
          // `rounded-full` on formButtonPrimary / socialButtonsBlockButton.
          borderRadius: '0.75rem',
          spacingUnit: '1rem',
        },
        elements: {
          // Primary CTA — pill-shaped, matching the "Run simulation" button
          // treatment in ProfitPoolAnalysis2.tsx.
          formButtonPrimary:
            'rounded-full bg-[#005db5] hover:bg-[#0052a0] text-white font-semibold tracking-tight shadow-[0_6px_18px_-6px_rgba(0,93,181,0.45)] transition-colors normal-case',
          // The outer card — we nest <SignIn /> inside our own editorial card,
          // so Clerk's internal card should be invisible. The page-level
          // appearance prop overrides these again for sign-in/up specifically.
          card: 'shadow-none border-none bg-transparent',
          // Header typography matches the editorial h1 treatment.
          headerTitle:
            'text-[#00345e] font-extrabold tracking-tight',
          headerSubtitle: 'text-[#26619d]',
          // Social buttons — tonal container treatment (pill, surfaceLow).
          socialButtonsBlockButton:
            'rounded-full border-none bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00345e] font-semibold normal-case',
          socialButtonsBlockButtonText: 'text-[#00345e] font-semibold',
          // Dividers
          dividerLine: 'bg-[#dce9ff]',
          dividerText: 'text-[#26619d] uppercase tracking-[0.15em] text-[11px] font-bold',
          // Form fields — soft fill, no visible border, pill radius via variables
          formFieldLabel: 'text-[#00345e] font-semibold',
          formFieldInput:
            'bg-[#eff4ff] border-none text-[#00345e] focus:ring-2 focus:ring-[#005db5] focus:bg-white',
          formFieldInputShowPasswordButton: 'text-[#26619d] hover:text-[#005db5]',
          formFieldHintText: 'text-[#26619d]',
          // Links (e.g. "Forgot password?", "Sign up")
          footerActionLink:
            'text-[#005db5] hover:text-[#00345e] font-semibold underline-offset-4',
          footerActionText: 'text-[#26619d]',
          identityPreviewText: 'text-[#00345e]',
          identityPreviewEditButton: 'text-[#005db5] hover:text-[#00345e]',
          // The tiny "Secured by Clerk" chip — tone it down to fit palette
          footer: 'bg-transparent',
          footerPages: 'text-[#26619d]',
        },
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
          showOptionalFields: false,
        },
      }}
    >
      <html lang="en" className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
        </head>
        <body
          style={{
            fontFamily:
              "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
            backgroundColor: '#f8f9ff',
            color: '#00345e',
          }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
