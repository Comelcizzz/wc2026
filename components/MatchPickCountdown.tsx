'use client';
import { useEffect, useState } from 'react';
import { msUntilPickClose } from '@/lib/matchSchedule';
import { formatDuration } from '@/lib/matchSchedule';

export default function MatchPickCountdown({ matchId }: { matchId: string }) {
  const [ms, setMs] = useState<number | null>(() => msUntilPickClose(matchId));

  useEffect(() => {
    const tick = () => setMs(msUntilPickClose(matchId));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [matchId]);

  if (ms == null) return null;
  if (ms <= 0) {
    return <span className="match-lock-badge locked">Закрито</span>;
  }
  const urgent = ms < 60 * 60 * 1000;
  return (
    <span className={`match-lock-badge${urgent ? ' urgent' : ''}`}>
      {urgent ? 'Скоро закриється · ' : 'Відкрито · '}
      {formatDuration(ms)}
    </span>
  );
}
