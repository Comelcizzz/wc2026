'use client';

import Link from 'next/link';
import { usePool } from '@/lib/usePool';
import { displayName, rankFlair, rankTitle } from '@/lib/flair';
import TeamFlag from '@/components/TeamFlag';

export default function StandingsPage() {
  const { pool, err, refresh } = usePool();

  if (err) {
    return (
      <div className="card">
        <strong>Could not load pool data</strong>
        <p className="muted small" style={{ marginTop: 6 }}>{err}</p>
      </div>
    );
  }
  if (!pool) return <div className="card muted">Loading...</div>;

  const s = pool.settings;
  const fee = s.entryFee || 20;
  const paidCount = pool.participants.filter((p) => p.paid).length;
  const total = paidCount * fee;
  const p1 = Math.floor(total * (s.prizeFirst || 70) / 100);
  const p2 = Math.floor(total * (s.prizeSecond || 20) / 100);
  const p3 = Math.floor(total * (s.prizeThird || 10) / 100);
  const played = pool.matches.filter(
    (m) => m.result != null && (m.result.winner || m.result.homeGoals != null),
  ).length;

  const prizeFor = (i: number) => {
    if (i === 0 && p1 > 0) return `$${p1}`;
    if (i === 1 && p2 > 0) return `$${p2}`;
    if (i === 2 && p3 > 0) return `$${p3}`;
    return '';
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Standings</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => refresh()}>
          ↻ Refresh
        </button>
      </div>

      <div className="metric-grid section">
        <div className="metric">
          <div className="label">Participants</div>
          <div className="value">{pool.participants.length}</div>
        </div>
        <div className="metric">
          <div className="label">Total Pot</div>
          <div className="value gold">${total}</div>
          <div className="sub">{paidCount} paid</div>
        </div>
        <div className="metric">
          <div className="label">1st Prize</div>
          <div className="value gold">${p1}</div>
        </div>
        <div className="metric">
          <div className="label">Matches Played</div>
          <div className="value">{played}</div>
          <div className="sub">of {pool.matches.length}</div>
        </div>
      </div>

      <section className="section">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="muted small">Group points carry over · knockout from the re-draft</span>
          <Link href="/picks" className="btn btn-primary btn-sm">Make picks</Link>
        </div>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name / Picks</th>
                <th className="hide-sm">Group</th>
                <th className="hide-sm">Knockout</th>
                <th>Total</th>
                <th>Prize</th>
                <th className="hide-sm">Paid</th>
              </tr>
            </thead>
            <tbody>
              {pool.standings.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    No picks yet.
                  </td>
                </tr>
              )}
              {pool.standings.map((p, i) => {
                const title = rankTitle(i, pool.standings.length);
                const flair = rankFlair(i);
                return (
                  <tr key={p.id} className={i === 0 ? 'leader-row' : undefined}>
                    <td>
                      <span className={`rank-badge rank-${Math.min(i + 1, 3)}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                    </td>
                    <td>
                      <strong>{displayName(p.name)}</strong>
                      {flair && <span className="rank-flair"> {flair}</span>}
                      {p.championCorrect && <span title="Correct champion"> 🏆</span>}
                      {title && <span className="rank-title">{title}</span>}
                      <div className="muted player-sub">
                        {p.champion ? <><TeamFlag team={p.champion} size={14} /> {p.champion}</> : <em>No champion pick</em>}
                        {' · '}
                        {p.totalGoals != null ? `⚽ ${p.totalGoals} goals` : <em>No goals guess</em>}
                        {' · '}
                        {p.koSubmittedAt ? 'Bracket in' : 'No bracket'}
                        <span className="show-sm">
                          {' · '}
                          {p.paid ? '✓ Paid' : 'Unpaid'} · {p.groupPoints}+{p.koPoints} pts
                        </span>
                      </div>
                    </td>
                    <td className="muted hide-sm">{p.groupPoints}</td>
                    <td className="muted hide-sm">{p.koPoints}</td>
                    <td className="pts">{p.totalPoints}</td>
                    <td>
                      {prizeFor(i) ? <span className="prize-chip">{prizeFor(i)}</span> : ''}
                    </td>
                    <td className="hide-sm">
                      <span className={`paid-chip ${p.paid ? 'paid-yes' : 'paid-no'}`}>
                        {p.paid ? '✓ PAID' : 'UNPAID'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
