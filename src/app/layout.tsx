import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Loan Broker Portal',
  description: 'Business loan broker client & partner portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>
          <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
