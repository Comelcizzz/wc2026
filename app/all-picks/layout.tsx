import { redirect } from 'next/navigation';
import { canAccessAllPicks } from '@/lib/allPicksAccess';
import { getPlayerId } from '@/lib/auth';
import { readPool } from '@/lib/poolStore';

export default async function AllPicksLayout({ children }: { children: React.ReactNode }) {
  const id = getPlayerId();
  if (!id) redirect('/picks');

  const pool = await readPool();
  const player = pool.participants.find((p) => p.id === id);
  if (!canAccessAllPicks(player?.name)) redirect('/picks');

  return children;
}
