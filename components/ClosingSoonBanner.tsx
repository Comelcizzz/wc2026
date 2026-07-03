'use client';
import { useEffect, useState } from 'react';
import { formatDuration, matchesClosingSoon, upcomingOpenMatches } from '@/lib/matchSchedule';
import { ROUND_LABELS } from '@/lib/tournament';
import type { KoPicks, Round } from '@/lib/types';
import type { UpcomingMatch } from '@/lib/matchSchedule';

export default function ClosingSoonBanner({
  nowIso,
  maxRound,
  matchIds,
  koPicks,
}: {
  nowIso?: string;
  maxRound: Round;
  matchIds: string[];
  koPicks: KoPicks;
}) {
  const [now, setNow] = useState(() => (nowIso ? new Date(nowIso).getTime() : Date.now()));

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const allowed = new Set(matchIds);
  const closing = matchesClosingSoon(now, 60 * 60 * 1000, maxRound).filter((m) => allowed.has(m.id));
  const closingIds = new Set(closing.map((m) => m.id));
  const upcoming = upcomingOpenMatches(now, 2, maxRound).filter((m) => allowed.has(m.id) && !closingIds.has(m.id));

  if (closing.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="closing-soon-banner">
      {closing.length > 0 && (
        <div className="closing-soon-urgent">
          <strong>Locking soon</strong>
          <span className="muted small">
            Score picks close 1 hour before kickoff (Toronto time). Do not leave points on the table.
          </span>
          <div className="closing-soon-list">
            {closing.slice(0, 2).map((m) => (
              <ClosingMatchChip key={m.id} match={m} now={now} picked={hasPick(koPicks[m.id])} urgent />
            ))}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="closing-soon-next">
          <strong>Up next · through {ROUND_LABELS[maxRound]}</strong>
          <div className="closing-soon-list">
            {upcoming.map((m) => (
              <ClosingMatchChip key={m.id} match={m} now={now} picked={hasPick(koPicks[m.id])} />
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
  picked,
  urgent,
}: {
  match: UpcomingMatch;
  now: number;
  picked: boolean;
  urgent?: boolean;
}) {
  const closeMs = Math.max(0, match.closeMs - (Date.now() - now));
  const nudge = picked
    ? 'Pick saved'
    : urgent
      ? 'Hurry up — this one is almost gone'
      : 'No pick yet — get it in early';
  return (
    <div className={`closing-match-chip${urgent ? ' urgent' : ''}`}>
      <span className="cmc-round">{ROUND_LABELS[match.round]}</span>
      <span className="cmc-label">{match.kickoffLabel}</span>
      <span className="cmc-time">locks in {formatDuration(closeMs)}</span>
      <span className={`cmc-nudge${picked ? ' picked' : ''}`}>{nudge}</span>
    </div>
  );
}

function hasPick(pick: KoPicks[string] | undefined): boolean {
  return !!pick && Number.isInteger(pick.h) && Number.isInteger(pick.a) && (pick.h !== pick.a || !!pick.et);
}
