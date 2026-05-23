import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
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
          DEFAULT: 'var(--color-primary, #2563eb)',
          dark:    'var(--color-primary-dark, #1e3a8a)',
          light:   'var(--color-primary-light, #dbeafe)',
          50:      'var(--color-primary-50, #eff6ff)',
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
