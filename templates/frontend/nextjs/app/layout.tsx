import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Plateforme — Next.js DevSecOps Starter',
  description: 'Fullstack Next.js starter with a live backend endpoint explorer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
