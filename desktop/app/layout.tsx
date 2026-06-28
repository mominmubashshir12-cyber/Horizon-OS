// Root layout — wraps entire app with AuthProvider, Sonner toaster, and global styles
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { Montserrat } from 'next/font/google';
// @ts-ignore
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'Horizon OS',
  description: 'Business Operating System for Horizon IT Solutions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${montserrat.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#f8fafc',
              },
            }}
            richColors
            closeButton
          />
        </AuthProvider>
      </body>
    </html>
  );
}
