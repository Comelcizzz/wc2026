'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canAccessAllPicks } from '@/lib/allPicksAccess';

const LINKS = [
  { href: '/', label: 'How It Works' },
  { href: '/picks', label: 'My Picks' },
  { href: '/all-picks', label: 'All Picks', private: true },
  { href: '/standings', label: 'Standings' },
  { href: '/chat', label: 'Chat' },
  { href: '/pot', label: 'The Pot' },
  { href: '/admin', label: 'Admin' },
] as const;

export default function Nav() {
  const pathname = usePathname();
  const [allPicksAccess, setAllPicksAccess] = useState(false);

  useEffect(() => {
    fetch('/api/login', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAllPicksAccess(canAccessAllPicks(d?.name)))
      .catch(() => setAllPicksAccess(false));
  }, []);

  return (
    <nav className="nav">
      {LINKS.map(({ href, label, ...rest }) => {
        if ('private' in rest && rest.private && !allPicksAccess) return null;
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
