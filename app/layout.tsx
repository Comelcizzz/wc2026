import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import LogoEasterEgg from '@/components/LogoEasterEgg';

export const metadata: Metadata = {
  title: 'World Cup 2026 Pool',
  description: 'Round of 32 re-draft - full bracket predictions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="header-inner">
            <LogoEasterEgg />
            <span className="header-title">World Cup 2026 Pool</span>
            <Nav />
          </div>
        </header>
        <main>
          <div className="container">{children}</div>
        </main>
      </body>
    </html>
  );
}
