import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'DocPilot — Express API Documentation Generator',
  description:
    'Analyze Express source code and public GitHub repositories, then generate OpenAPI 3.1 documentation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
