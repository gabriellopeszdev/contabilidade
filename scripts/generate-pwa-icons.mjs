/**
 * Gera os ícones PNG para o PWA do FiscoHub a partir do SVG do logo.
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';

const svgIcon = (size, padding) => {
  const logoSize = size - padding * 2;
  const scale = logoSize / 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0f1e"/>
  <g transform="translate(${padding}, ${padding}) scale(${scale})">
    <defs>
      <linearGradient id="fh-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
        <stop stop-color="#2563EB"/>
        <stop offset="1" stop-color="#1D4ED8"/>
      </linearGradient>
    </defs>
    <path d="M24 2L43.05 13V35L24 46L4.95 35V13L24 2Z" fill="url(#fh-grad)"/>
    <path d="M16 14H32V19H21V23H30V28H21V34H16V14Z" fill="white"/>
    <rect x="21" y="23" width="9" height="5" rx="0.5" fill="white" opacity="0.7"/>
  </g>
</svg>`;
};

const icons = [
  { name: 'icon-192.png',          size: 192, padding: 38  },
  { name: 'icon-512.png',          size: 512, padding: 100 },
  { name: 'icon-maskable-192.png', size: 192, padding: 18  },
  { name: 'icon-maskable-512.png', size: 512, padding: 48  },
  { name: 'apple-touch-icon.png',  size: 180, padding: 34  },
];

await mkdir('public', { recursive: true });

for (const icon of icons) {
  const svg = svgIcon(icon.size, icon.padding);
  await sharp(Buffer.from(svg)).png().toFile(`public/${icon.name}`);
  console.log(`✔  public/${icon.name}`);
}

console.log('\nÍcones PWA gerados com sucesso.');
