'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TeamFlag from '@/components/TeamFlag';
import { resolveRealKoTeams, resultsFromMatches } from '@/lib/bracket';
import { displayName } from '@/lib/flair';
import { gradeGroupMatch, gradeKoMatch, koMissLabel, type GradeStatus } from '@/lib/scoring';
import { GROUPS, KO_MATCH_IDS, KO_META, KO_ROUNDS, ROUND_LABELS } from '@/lib/tournament';
import { usePool } from '@/lib/usePool';
import type { Match, Round, ScorePick } from '@/lib/types';

type PageTab = 'group' | Round;

const PAGE_TABS: PageTab[] = ['group', ...KO_ROUNDS];

function gradeLabel(
  status: GradeStatus,
  points: number,
  missReason?: Parameters<typeof koMissLabel>[0],
): { cls: string; txt: string } {
  if (status === 'exact') return { cls: 'exact', txt: `Exact +${points}` };
  if (status === 'correct') return { cls: 'correct', txt: points > 0 ? `+${points}` : 'Correct' };
  if (status === 'miss') return { cls: 'wrong', txt: koMissLabel(missReason) };
  if (status === 'nopick') return { cls: '', txt: 'No pick' };
  return { cls: '', txt: '' };
}


function ReadOnlyPickRow({
  name,
  pick,
  gradeCls,
  gradeTxt,
  isKo,
  home,
  away,
}: {
  name: string;
  pick: ScorePick | { h: number; a: number } | undefined;
  gradeCls: string;
  gradeTxt: string;
  isKo: boolean;
  home?: string | null;
  away?: string | null;
}) {
  const hasH = pick && Number.isInteger(pick.h);
  const hasA = pick && Number.isInteger(pick.a);
  const isDraw = hasH && hasA && pick!.h === pick!.a;
  const et = pick && 'et' in pick ? pick.et : undefined;

  return (
    <div className={`all-picks-pick-row${gradeCls ? ` line-${gradeCls}` : ''}`}>
      <div className="all-picks-pick-player">
        <strong>{displayName(name)}</strong>
        {gradeTxt ? <span className={`result-badge ${gradeCls}`}>{gradeTxt}</span> : null}
      </div>
      <div className="all-picks-pick-fields" aria-label={`${name} predicted score`}>
        <span className={`score-display view-only${hasH ? ' filled' : ''}`}>
          {hasH ? pick!.h : '–'}
        </span>
        <span className="muted" style={{ fontWeight: 900 }}>:</span>
        <span className={`score-display view-only${hasA ? ' filled' : ''}`}>
          {hasA ? pick!.a : '–'}
        </span>
      </div>
      {isKo && isDraw && home && away && (
        <div className="all-picks-et-row">
          <span className="all-picks-et-label">ET / pens winner</span>
          {et ? (
            <span className="et-winner-badge view-only">
              <TeamFlag team={et} size={16} />
              {et}
            </span>
          ) : (
            <span className="et-winner-badge view-only missing">Not picked</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AllPicksPage() {
  return (
    <Suspense fallback={<div className="card muted">Loading...</div>}>
      <AllPicksContent />
    </Suspense>
  );
}

function AllPicksContent() {
  const { pool, err, refresh } = usePool();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageTab, setPageTab] = useState<PageTab>('group');
  const [group, setGroup] = useState('A');

  const selectedId = searchParams.get('m') || '';

  const koResultsMap = useMemo(
    () => (pool ? resultsFromMatches(pool.matches) : {}),
    [pool],
  );

  const resolvedOfficial = useMemo(() => {
    if (!pool) return {};
    const out: Record<string, { home: string | null; away: string | null } | null> = {};
    for (const m of KO_MATCH_IDS) {
      out[m.id] = resolveRealKoTeams(m.id, koResultsMap, pool.koBracket);
    }
    return out;
  }, [pool, koResultsMap]);

  const groupKeys = useMemo(() => Object.keys(GROUPS).sort(), []);

  const tabMatches = useMemo(() => {
    if (!pool) return [] as Match[];
    if (pageTab === 'group') {
      return pool.matches
        .filter((m) => m.round === 'group' && m.group === group)
        .sort((a, b) => (a.matchday || 0) - (b.matchday || 0));
    }
    return KO_MATCH_IDS.filter((m) => m.round === pageTab).map((meta) => {
      const stored = pool.matches.find((x) => x.id === meta.id);
      return stored || { id: meta.id, round: meta.round, label: meta.label };
    });
  }, [pool, pageTab, group]);

  const selectedMatch = useMemo(() => {
    if (!pool || !selectedId) return null;
    const stored = pool.matches.find((m) => m.id === selectedId);
    if (stored) return stored;
    const meta = KO_MATCH_IDS.find((m) => m.id === selectedId);
    if (meta) return { id: meta.id, round: meta.round, label: meta.label } as Match;
    return null;
  }, [pool, selectedId]);

  // Keep tab + group in sync with the selected match from the URL.
  useEffect(() => {
    if (!selectedMatch) return;
    if (selectedMatch.round === 'group') {
      setPageTab('group');
      if (selectedMatch.group) setGroup(selectedMatch.group);
      return;
    }
    setPageTab(selectedMatch.round);
  }, [selectedMatch]);

  // Default to the first match in the current tab when nothing is selected.
  useEffect(() => {
    if (!pool || selectedId || tabMatches.length === 0) return;
    selectMatch(tabMatches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, pageTab, group, tabMatches.length]);

  function selectMatch(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('m', id);
    router.replace(`/all-picks?${params.toString()}`, { scroll: false });
  }

  function switchTab(tab: PageTab) {
    setPageTab(tab);
    const next =
      tab === 'group'
        ? pool?.matches.find((m) => m.round === 'group' && m.group === group)?.id
        : KO_MATCH_IDS.find((m) => m.round === tab)?.id;
    if (next) selectMatch(next);
  }

  if (err) {
    return (
      <div className="card">
        <strong>Could not load pool data</strong>
        <p className="muted small" style={{ marginTop: 6 }}>{err}</p>
      </div>
    );
  }
  if (!pool) return <div className="card muted">Loading...</div>;

  const standingsOrder = new Map(pool.standings.map((p, i) => [p.id, i]));
  const sortedParticipants = [...pool.participants].sort(
    (a, b) => (standingsOrder.get(a.id) ?? 999) - (standingsOrder.get(b.id) ?? 999),
  );

  const isGroup = selectedMatch?.round === 'group';
  const officialTeams = selectedMatch && !isGroup ? resolvedOfficial[selectedMatch.id] : null;
  const matchResult = selectedMatch?.result;
  const meta = selectedMatch ? KO_META[selectedMatch.id] : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Everyone&apos;s Picks</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            View only — tap a match to see every player&apos;s prediction. Picks cannot be edited here.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => refresh()}>
          ↻ Refresh
        </button>
      </div>

      <div className="page-tabs scrollable">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`page-tab${pageTab === tab ? ' active' : ''}`}
            onClick={() => switchTab(tab)}
          >
            {tab === 'group' ? 'Groups' : ROUND_LABELS[tab]}
          </button>
        ))}
      </div>

      {pageTab === 'group' && (
        <div className="group-nav section">
          {groupKeys.map((g) => (
            <button
              key={g}
              type="button"
              className={`group-nav-btn${group === g ? ' active' : ''}`}
              onClick={() => {
                setGroup(g);
                const first = pool.matches.find((m) => m.round === 'group' && m.group === g);
                if (first) selectMatch(first.id);
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="all-picks-layout section">
        <aside className="all-picks-matches card">
          <div className="all-picks-matches-head">
            <strong>{pageTab === 'group' ? `Group ${group}` : ROUND_LABELS[pageTab]}</strong>
            <span className="muted small">{tabMatches.length} matches</span>
          </div>
          <div className="all-picks-match-list">
            {tabMatches.map((m) => {
              const isKo = m.round !== 'group';
              const teams = isKo ? resolvedOfficial[m.id] : { home: m.home, away: m.away };
              const home = teams?.home;
              const away = teams?.away;
              const km = KO_META[m.id];
              const active = m.id === selectedId;
              const hasResult =
                m.result &&
                (m.result.winner != null || m.result.homeGoals != null);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`all-picks-match-btn${active ? ' active' : ''}${hasResult ? ' played' : ''}`}
                  onClick={() => selectMatch(m.id)}
                >
                  <span className="apm-meta">
                    <span>{isKo ? `M${km?.m ?? ''}` : m.date}</span>
                    {hasResult && <span className="apm-played-dot" title="Result entered" />}
                  </span>
                  <span className="apm-teams">
                    <span className="apm-team">
                      {home ? <TeamFlag team={home} size={14} /> : null}
                      <span className="apm-name">{home || 'TBD'}</span>
                    </span>
                    <span className="apm-vs">vs</span>
                    <span className="apm-team right">
                      <span className="apm-name">{away || 'TBD'}</span>
                      {away ? <TeamFlag team={away} size={14} className="right" /> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="all-picks-detail card">
          {!selectedMatch ? (
            <p className="muted" style={{ padding: 24, textAlign: 'center' }}>
              Select a match to view picks.
            </p>
          ) : (
            <>
              <div className="all-picks-detail-head">
                <div>
                  <span className="muted small">
                    {isGroup ? `Group ${selectedMatch.group} · ${selectedMatch.date}` : `M${meta?.m} · ${meta?.date}`}
                  </span>
                  <h2 className="all-picks-match-title">
                    {isGroup ? (
                      <>
                        <TeamFlag team={selectedMatch.home} size={20} />
                        {selectedMatch.home}
                        <span className="muted"> vs </span>
                        {selectedMatch.away}
                        <TeamFlag team={selectedMatch.away} size={20} className="right" />
                      </>
                    ) : officialTeams?.home && officialTeams?.away ? (
                      <>
                        <TeamFlag team={officialTeams.home} size={20} />
                        {officialTeams.home}
                        <span className="muted"> vs </span>
                        {officialTeams.away}
                        <TeamFlag team={officialTeams.away} size={20} className="right" />
                      </>
                    ) : (
                      <span className="muted">Teams TBD</span>
                    )}
                  </h2>
                </div>
                {matchResult && matchResult.homeGoals != null && (
                  <div className="all-picks-actual">
                    <span className="muted small">Actual</span>
                    <strong>
                      {matchResult.homeGoals}:{matchResult.awayGoals}
                    </strong>
                  </div>
                )}
              </div>

              <div className="all-picks-viewonly-banner">
                <span className="pill">View only</span>
                <span className="muted small">
                  Not editable — to change <strong>your</strong> pick go to{' '}
                  <Link href="/picks">My Picks</Link>.
                </span>
              </div>

              <div className="all-picks-readonly-list">
                {sortedParticipants.map((p) => {
                  const pick = isGroup
                    ? p.picks[selectedMatch.id]
                    : p.koPicks?.[selectedMatch.id];
                  const grade = isGroup
                    ? gradeGroupMatch(pick, matchResult)
                    : gradeKoMatch(selectedMatch.round, pick, matchResult);
                  const { cls, txt } = gradeLabel(grade.status, grade.points, grade.missReason);
                  const rowHome = isGroup ? selectedMatch.home : officialTeams?.home;
                  const rowAway = isGroup ? selectedMatch.away : officialTeams?.away;
                  return (
                    <ReadOnlyPickRow
                      key={p.id}
                      name={p.name}
                      pick={pick}
                      gradeCls={cls}
                      gradeTxt={txt}
                      isKo={!isGroup}
                      home={rowHome}
                      away={rowAway}
                    />
                  );
                })}
              </div>

              <p className="muted small" style={{ marginTop: 12 }}>
                {sortedParticipants.filter((p) => {
                  const pick = isGroup
                    ? p.picks[selectedMatch.id]
                    : p.koPicks?.[selectedMatch.id];
                  return pick && pick.h != null && pick.a != null;
                }).length}
                /{sortedParticipants.length} players have a pick for this match.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
