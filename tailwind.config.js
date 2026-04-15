/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7ff',
          100: '#e0efff',
          500: '#0071E3',
          600: '#0064D2',
          700: '#0056B3',
          900: '#003D82',
        },
        surface: {
          primary:   '#ffffff',
          secondary: '#F5F5F7',
          tertiary:  '#FBFBFD',
          quarternary: '#F9F9FB',
          hover:     '#EFEFEF',
        },
        content: {
          primary:   '#1D1D1F',
          secondary: '#6E6E73',
          tertiary:  '#86868B',
          quaternary:'#AEAEB2',
          inverse:   '#FFFFFF',
        },
        border: {
          DEFAULT:   'rgba(0,0,0,0.08)',
          subtle:    'rgba(0,0,0,0.04)',
          strong:    'rgba(0,0,0,0.12)',
        },
        status: {
          success:   '#34C759',
          warning:   '#FF9500',
          error:     '#FF3B30',
          info:      '#0071E3',
        },
        // PRISM semantic
        expansion:   '#30D158',
        contraction: '#FF453A',
        gold:        '#D4A847',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.035em', fontWeight: '800' }],
        'hero':    ['2.5rem', { lineHeight: '1.1',  letterSpacing: '-0.03em',  fontWeight: '800' }],
        'h1':      ['2rem',   { lineHeight: '1.15', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'h2':      ['1.5rem', { lineHeight: '1.2',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h3':      ['1.25rem',{ lineHeight: '1.3',  letterSpacing: '0',        fontWeight: '600' }],
        'body':    ['1rem',   { lineHeight: '1.5',  letterSpacing: '0',        fontWeight: '400' }],
        'small':   ['0.875rem',{ lineHeight: '1.5', letterSpacing: '0',        fontWeight: '400' }],
        'caption': ['0.75rem',{ lineHeight: '1.4',  letterSpacing: '0.02em',   fontWeight: '500' }],
        'overline':['0.6875rem',{ lineHeight: '1.3', letterSpacing: '0.08em',  fontWeight: '600' }],
      },
      borderRadius: {
        'apple': '18px',
        'card':  '12px',
        'btn':   '10px',
        'pill':  '999px',
      },
      boxShadow: {
        'apple-sm': '0 2px 8px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.04)',
        'apple-md': '0 4px 20px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.04)',
        'apple-lg': '0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        'apple-xl': '0 16px 48px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.04)',
        'card':     '0 0.5px 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        'card-hover':'0 2px 8px rgba(0,0,0,0.06), 0 0.5px 1px rgba(0,0,0,0.04)',
        'focus':    '0 0 0 4px rgba(0,113,227,0.12)',
      },
      animation: {
        'fade-in':     'fadeIn 0.15s ease-out forwards',
        'slide-up':    'slideUp 0.25s cubic-bezier(0.22,1,0.36,1) forwards',
        'slide-right': 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,113,227,0)' },
          '50%': { boxShadow: '0 0 12px 4px rgba(0,113,227,0.15)' },
        },
      },
    },
  },
  plugins: [],
};
