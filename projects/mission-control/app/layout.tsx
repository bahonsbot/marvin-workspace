import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';
import { MissionControlRuntimeProvider } from '@/components/chat/MissionControlRuntimeProvider';

export const metadata: Metadata = {
  title: 'Mission Control V1',
  description: 'OpenClaw companion shell scaffold',
};

const shellFonts = {
  '--font-sans': '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif',
  '--font-serif': '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
} as CSSProperties;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={shellFonts}>
        <MissionControlRuntimeProvider>
          <AppShell>{children}</AppShell>
        </MissionControlRuntimeProvider>
      </body>
    </html>
  );
}
