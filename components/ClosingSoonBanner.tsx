'use client';
import { useEffect, useState } from 'react';
import { formatDuration, matchesClosingSoon, upcomingOpenMatches } from '@/lib/matchSchedule';
import { ROUND_LABELS } from '@/lib/tournament';
import type { UpcomingMatch } from '@/lib/matchSchedule';

export default function ClosingSoonBanner({ nowIso }: { nowIso?: string }) {
  const [now, setNow] = useState(() => (nowIso ? new Date(nowIso).getTime() : Date.now()));

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const closing = matchesClosingSoon(now);
  const upcoming = upcomingOpenMatches(now, 2);

  if (closing.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="closing-soon-banner">
      {closing.length > 0 && (
        <div className="closing-soon-urgent">
          <strong>Матчі скоро закриваються</strong>
          <span className="muted small">
            Вибір рахунку закривається за 1 годину до початку матчу
          </span>
          <div className="closing-soon-list">
            {closing.slice(0, 2).map((m) => (
              <ClosingMatchChip key={m.id} match={m} now={now} urgent />
            ))}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="closing-soon-next">
          <strong>Наступні матчі для піків</strong>
          <div className="closing-soon-list">
            {upcoming.map((m) => (
              <ClosingMatchChip key={m.id} match={m} now={now} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClosingMatchChip({
  match,
  now,
  urgent,
}: {
  match: UpcomingMatch;
  now: number;
  urgent?: boolean;
}) {
  const closeMs = Math.max(0, match.closeMs - (Date.now() - now));
  return (
    <div className={`closing-match-chip${urgent ? ' urgent' : ''}`}>
      <span className="cmc-round">{ROUND_LABELS[match.round]}</span>
      <span className="cmc-label">{match.kickoffLabel}</span>
      <span className="cmc-time">закриється через {formatDuration(closeMs)}</span>
    </div>
  );
}
