'use client';
import { useEffect, useState } from 'react';
import { formatDuration, matchesClosingSoon, upcomingOpenMatches } from '@/lib/matchSchedule';
import { KO_META, ROUND_LABELS } from '@/lib/tournament';
import TeamFlag from '@/components/TeamFlag';
import type { KoPicks, Round } from '@/lib/types';
import type { UpcomingMatch } from '@/lib/matchSchedule';

export default function ClosingSoonBanner({
  nowIso,
  maxRound,
  matchIds,
  koPicks,
  teamsById,
}: {
  nowIso?: string;
  maxRound: Round;
  matchIds: string[];
  koPicks: KoPicks;
  teamsById: Record<string, { home: string | null; away: string | null } | null>;
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
            {closing.slice(0, 3).map((m) => (
              <ClosingMatchCard
                key={m.id}
                match={m}
                now={now}
                picked={hasPick(koPicks[m.id])}
                teams={teamsById[m.id]}
                urgent
              />
            ))}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="closing-soon-next">
          <strong>Up next · through {ROUND_LABELS[maxRound]}</strong>
          <div className="closing-soon-list">
            {upcoming.map((m) => (
              <ClosingMatchCard
                key={m.id}
                match={m}
                now={now}
                picked={hasPick(koPicks[m.id])}
                teams={teamsById[m.id]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClosingMatchCard({
  match,
  now,
  picked,
  teams,
  urgent,
}: {
  match: UpcomingMatch;
  now: number;
  picked: boolean;
  teams: { home: string | null; away: string | null } | null | undefined;
  urgent?: boolean;
}) {
  const closeMs = Math.max(0, match.closeMs - (Date.now() - now));
  const meta = KO_META[match.id];
  const closeAt = new Date(Date.now() + closeMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const nudge = picked
    ? 'Pick saved'
    : urgent
      ? 'Hurry up — this one is almost gone'
      : 'No pick yet — get it in early';
  return (
    <div className={`closing-match-card${urgent ? ' urgent' : ''}${picked ? ' picked' : ''}`}>
      <div className="cmc-topline">
        <span className="cmc-round">{ROUND_LABELS[match.round]}</span>
        <span className={`cmc-status${picked ? ' picked' : ''}`}>{picked ? 'Saved' : 'Needs pick'}</span>
      </div>
      <div className="cmc-match-meta">
        <span>M{meta?.m ?? match.id}</span>
        <span>Kickoff {match.kickoffLabel}</span>
      </div>
      <div className="cmc-teams">
        <span className="cmc-team">
          <TeamFlag team={teams?.home || null} size={18} />
          {teams?.home || 'TBD'}
        </span>
        <span className="cmc-vs">vs</span>
        <span className="cmc-team right">
          {teams?.away || 'TBD'}
          <TeamFlag team={teams?.away || null} size={18} className="right" />
        </span>
      </div>
      <div className="cmc-lock-row">
        <strong>{urgent ? 'Locks soon' : 'Locks'}</strong>
        <span>{formatDuration(closeMs)} · {closeAt}</span>
      </div>
      <span className={`cmc-nudge${picked ? ' picked' : ''}`}>{nudge}</span>
    </div>
  );
}

function hasPick(pick: KoPicks[string] | undefined): boolean {
  return !!pick && Number.isInteger(pick.h) && Number.isInteger(pick.a) && (pick.h !== pick.a || !!pick.et);
}
