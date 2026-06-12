'use client';

import dynamic from 'next/dynamic';

const Toaster = dynamic(
  () => import('sonner').then((mod) => mod.Toaster),
  { ssr: false },
);

export function ToasterProvider() {
  return <Toaster richColors position="top-right" />;
}
