import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,ts,tsx,js,jsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'hsl(240 10% 4%)',
          soft: 'hsl(240 8% 7%)',
          card: 'hsl(240 6% 10%)',
        },
        fg: {
          DEFAULT: 'hsl(0 0% 98%)',
          muted: 'hsl(240 5% 65%)',
          subtle: 'hsl(240 4% 46%)',
        },
        duck: {
          DEFAULT: 'hsl(45 96% 56%)',
          glow: 'hsl(38 92% 50%)',
          deep: 'hsl(28 92% 45%)',
        },
        border: 'hsl(240 6% 18%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-duck':
          'linear-gradient(135deg, hsl(45 96% 56%) 0%, hsl(28 92% 45%) 100%)',
        'gradient-radial':
          'radial-gradient(ellipse at top, hsl(45 96% 56% / 0.15), transparent 50%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-8px) rotate(2deg)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        glow: 'glow 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
      },
    },
  },
};

export default config;
