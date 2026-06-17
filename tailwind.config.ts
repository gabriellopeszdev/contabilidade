import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    // App Router — páginas, layouts e rotas
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Camada de apresentação — componentes, hooks e contextos
    './src/presentation/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Escalas de cores consistentes com o design system do dashboard
      colors: {
        gray: {
          950: '#030712',
        },
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // White Label — alimentadas por CSS vars injetadas pelo useTheme
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb, 37 99 235) / <alpha-value>)',
          dark:    'rgb(var(--color-primary-dark-rgb, 30 58 138) / <alpha-value>)',
          light:   'rgb(var(--color-primary-light-rgb, 219 234 254) / <alpha-value>)',
          50:      'rgb(var(--color-primary-50-rgb, 239 246 255) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl:  '0.75rem',
        '2xl': '1rem',
      },
      // Breakpoint extra para monitores wide (dashboards)
      screens: {
        '3xl': '1920px',
      },
    },
  },
  plugins: [
    // Utilitários de animação: animate-in, slide-in-from-*, fade-in, etc.
    // Usados nos Toasts e painéis de notificação (lote/page.tsx).
    tailwindcssAnimate,
  ],
};

export default config;
