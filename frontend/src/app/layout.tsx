// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'OnlyFeets — Contenido exclusivo',
  description: 'Descubre contenido exclusivo de tus creadoras favoritas',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'OnlyFeets',
    description: 'Plataforma de contenido exclusivo',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
