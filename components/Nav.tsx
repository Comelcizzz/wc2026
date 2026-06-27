'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'How It Works' },
  { href: '/picks', label: 'My Picks' },
  { href: '/standings', label: 'Standings' },
  { href: '/pot', label: 'The Pot' },
  { href: '/admin', label: 'Admin' },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? 'active' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
