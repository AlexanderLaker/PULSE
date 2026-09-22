import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
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
  title: 'PRISM Profit Pool Shift Model',
  description: 'Profit Pool Simulation Engine: Strategic FMCG Analysis',
};

// Browser and OS chrome in the brand's deep navy.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00345E',
};

/**
 * Clerk's `appearance` styles every element Clerk renders (sign-in, sign-up
 * and their verification steps) in the dashboard's design system:
 *   - the maritime blue palette (#005db5 primary, #00345e on-surface)
 *   - pill-shaped primary buttons
 *   - Manrope for headings, Inter for body text
 *   - soft tonal accents instead of hard 1px borders
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
          // The dashboard's palette (lib/theme.ts).
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
            'rounded-full bg-[#005db5] hover:bg-[#0052a0] text-white font-semibold tracking-tight shadow-[0_6px_18px_-6px_rgba(0,93,181,0.45)] transition-colors normal-case',
          // The sign-in and sign-up pages draw their own card around Clerk's
          // form, so Clerk's card stays invisible; their appearance props
          // refine this further.
          card: 'shadow-none border-none bg-transparent',
          // Header typography matches the editorial h1 treatment.
          headerTitle:
            'text-[#00345e] font-extrabold tracking-tight',
          headerSubtitle: 'text-[#26619d]',
          // Social buttons: tonal pills on surfaceLow.
          socialButtonsBlockButton:
            'rounded-full border-none bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00345e] font-semibold normal-case',
          socialButtonsBlockButtonText: 'text-[#00345e] font-semibold',
          // Dividers
          dividerLine: 'bg-[#dce9ff]',
          dividerText: 'text-[#26619d] uppercase tracking-[0.15em] text-[11px] font-bold',
          // Form fields: soft fill, no visible border.
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
          // The small "Secured by Clerk" footer, toned down to the palette.
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
