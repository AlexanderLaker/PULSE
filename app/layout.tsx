import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import { S, BODY_FONT, HEADLINE_FONT } from '@/lib/theme';
import './globals.css';

/**
 * Manrope, Inter and JetBrains Mono are self-hosted at build time with
 * next/font (no request to Google at runtime) and exposed as the CSS
 * variables lib/theme.ts reads. next/font's default size-adjusted fallbacks
 * keep dense layouts from jumping when the fonts arrive.
 */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'PRISM',
  description: 'PRISM, the Profit Pool Risk & Intelligence Simulation Model: how external drivers shift the gross '
    + 'profit of Henkel Consumer Brands’ categories, 2026 to 2035.',
  appleWebApp: { capable: true },
};

// Browser and OS chrome in the brand's deep navy.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: S.onSurface,
};

/**
 * Clerk's `appearance` styles every element Clerk renders (sign-in, sign-up
 * and their verification steps) in the dashboard's design system: the colour
 * variables come from lib/theme.ts, and the element classes name the same
 * tokens as Tailwind classes (tailwind.config.ts), written out in full because
 * Tailwind only generates the classes it finds in the source. Primary buttons
 * are pills, headings use Manrope and body text Inter, and fields use soft
 * tonal fills instead of hard borders.
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
          colorPrimary: S.primary,
          colorText: S.onSurface,
          colorTextSecondary: S.onSurfaceVariant,
          colorBackground: S.surface,
          colorInputBackground: S.surfaceLow,
          colorInputText: S.onSurface,
          colorNeutral: S.onSurface,
          colorDanger: S.error,
          colorSuccess: S.success,
          colorWarning: S.amber,
          fontFamily: BODY_FONT,
          fontFamilyButtons: HEADLINE_FONT,
          fontSize: '14px',
          // Keep this modest: Clerk applies the global radius to its card and
          // main containers too, and a fully rounded one turns a roughly square
          // container into a circle. The pill buttons get `rounded-full` on
          // formButtonPrimary and socialButtonsBlockButton instead.
          borderRadius: '0.75rem',
          spacingUnit: '1rem',
        },
        elements: {
          // Primary button: a pill, like the dashboard's primary buttons.
          formButtonPrimary:
            'rounded-full bg-theme-primary hover:bg-theme-primary-dim text-theme-on-primary font-semibold tracking-tight shadow-primary-button transition-colors normal-case',
          // The sign-in and sign-up pages draw their own card around Clerk's
          // form (app/(auth)/layout.tsx), so Clerk's card stays invisible;
          // EMBEDDED_FORM in app/(auth)/shared.tsx refines this further.
          card: 'shadow-none border-none bg-transparent',
          // Header typography matches the editorial h1 treatment.
          headerTitle:
            'text-theme-on-surface font-extrabold tracking-tight',
          headerSubtitle: 'text-theme-on-surface-variant',
          // Social buttons: tonal pills on surfaceLow.
          socialButtonsBlockButton:
            'rounded-full border-none bg-theme-surface-low hover:bg-theme-surface-high text-theme-on-surface font-semibold normal-case',
          socialButtonsBlockButtonText: 'text-theme-on-surface font-semibold',
          // Dividers
          dividerLine: 'bg-theme-surface-high',
          dividerText: 'text-theme-on-surface-variant uppercase tracking-[0.15em] text-[11px] font-bold',
          // Form fields: soft fill, no visible border.
          formFieldLabel: 'text-theme-on-surface font-semibold',
          formFieldInput:
            'bg-theme-surface-low border-none text-theme-on-surface focus:ring-2 focus:ring-theme-primary focus:bg-theme-surface',
          formFieldInputShowPasswordButton: 'text-theme-on-surface-variant hover:text-theme-primary',
          formFieldHintText: 'text-theme-on-surface-variant',
          // Links (e.g. "Forgot password?", "Sign up")
          footerActionLink:
            'text-theme-primary hover:text-theme-on-surface font-semibold underline-offset-4',
          footerActionText: 'text-theme-on-surface-variant',
          identityPreviewText: 'text-theme-on-surface',
          identityPreviewEditButton: 'text-theme-primary hover:text-theme-on-surface',
          // The small "Secured by Clerk" footer, toned down to the palette.
          footer: 'bg-transparent',
          footerPages: 'text-theme-on-surface-variant',
        },
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
          showOptionalFields: false,
        },
      }}
    >
      <html lang="en" className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
        {/* The body's font, background and text colour are set in globals.css. */}
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
