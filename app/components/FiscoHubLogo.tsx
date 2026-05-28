import { SVGProps } from 'react';

interface FiscoHubLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: 14, gap: 8 },
  md: { icon: 36, text: 18, gap: 10 },
  lg: { icon: 48, text: 24, gap: 12 },
  xl: { icon: 64, text: 32, gap: 16 },
};

export function FiscoHubLogo({ size = 'md', variant = 'full', className = '' }: FiscoHubLogoProps) {
  const s = SIZES[size];

  return (
    <div className={`inline-flex items-center ${className}`} style={{ gap: s.gap }}>
      {/* Ícone: hexágono estilizado com "F" */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Fundo hexagonal */}
        <path
          d="M24 2L43.05 13V35L24 46L4.95 35V13L24 2Z"
          fill="url(#fh-grad)"
        />
        {/* Letra F estilizada */}
        <path
          d="M16 14H32V19H21V23H30V28H21V34H16V14Z"
          fill="white"
        />
        {/* Acento decorativo — linha horizontal no "H" implícito */}
        <rect x="21" y="23" width="9" height="5" rx="0.5" fill="white" opacity="0.7" />
        <defs>
          <linearGradient id="fh-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Texto: FiscoHub */}
      {variant === 'full' && (
        <span
          className="font-bold tracking-tight text-gray-900 dark:text-white select-none"
          style={{ fontSize: s.text, lineHeight: 1 }}
        >
          Fisco<span className="text-blue-600">Hub</span>
        </span>
      )}
    </div>
  );
}

/** Versão SVG pura (para export/favicon) */
export function FiscoHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M24 2L43.05 13V35L24 46L4.95 35V13L24 2Z"
        fill="url(#fh-icon-grad)"
      />
      <path
        d="M16 14H32V19H21V23H30V28H21V34H16V14Z"
        fill="white"
      />
      <rect x="21" y="23" width="9" height="5" rx="0.5" fill="white" opacity="0.7" />
      <defs>
        <linearGradient id="fh-icon-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
