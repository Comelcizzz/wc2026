'use client';

import { useMemo } from 'react';
import { usePool } from '@/lib/usePool';
import { displayName } from '@/lib/flair';
import TeamFlag from '@/components/TeamFlag';

export default function PotPage() {
  const { pool, err, refresh } = usePool();

  const championStats = useMemo(() => {
    if (!pool) return [];
    const counts: Record<string, number> = {};
    let withChampion = 0;
    for (const p of pool.participants) {
      if (p.champion) {
        counts[p.champion] = (counts[p.champion] || 0) + 1;
        withChampion++;
      }
    }
    return Object.entries(counts)
      .map(([team, count]) => ({
        team,
        count,
        pct: withChampion > 0 ? Math.round((count / withChampion) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [pool]);

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
  const parts = pool.participants;
  const paidParts = parts.filter((p) => p.paid);
  const unpaidParts = parts.filter((p) => !p.paid);
  const paidTotal = paidParts.length * fee;
  const unpaidTotal = unpaidParts.length * fee;
  const fullTotal = parts.length * fee;
  const p1 = Math.floor(paidTotal * (s.prizeFirst || 70) / 100);
  const p2 = Math.floor(paidTotal * (s.prizeSecond || 20) / 100);
  const p3 = Math.floor(paidTotal * (s.prizeThird || 10) / 100);
  const pct = fullTotal > 0 ? Math.round((paidTotal / fullTotal) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">The Pot</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => refresh()}>
          ↻ Refresh
        </button>
      </div>

      <div className="pot-grid section">
        <div className="metric">
          <div className="label">Total Pot (paid)</div>
          <div className="value gold pot-big">${paidTotal}</div>
          <div className="sub">{paidParts.length} of {parts.length} paid</div>
        </div>
        <div className="metric">
          <div className="label">Outstanding</div>
          <div className="value" style={{ color: 'var(--red)' }}>${unpaidTotal}</div>
          <div className="sub">{unpaidParts.length} unpaid</div>
        </div>
        <div className="metric">
          <div className="label">Entry Fee</div>
          <div className="value">${fee}</div>
        </div>
      </div>

      <div className="card section">
        <div className="progress-head">
          <span className="muted small">Cash collected</span>
          <strong>{pct}%</strong>
        </div>
        <div className="progress-wrap lg">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card section">
        <h3 className="pot-section-title">Prize Breakdown (current)</h3>
        <div className="prize-podium">
          <div className="prize-slot gold">
            <div className="prize-slot-label">🥇 1st Place</div>
            <div className="prize-slot-value">${p1}</div>
            <div className="muted" style={{ fontSize: 11 }}>{s.prizeFirst || 70}%</div>
          </div>
          <div className="prize-slot silver">
            <div className="prize-slot-label">🥈 2nd Place</div>
            <div className="prize-slot-value">${p2}</div>
            <div className="muted" style={{ fontSize: 11 }}>{s.prizeSecond || 20}%</div>
          </div>
          <div className="prize-slot bronze">
            <div className="prize-slot-label">🥉 3rd Place</div>
            <div className="prize-slot-value">${p3}</div>
            <div className="muted" style={{ fontSize: 11 }}>{s.prizeThird || 10}%</div>
          </div>
        </div>
      </div>

      {championStats.length > 0 && (
        <div className="card section">
          <h3 className="pot-section-title">Champion Picks</h3>
          <div className="champion-stats">
            {championStats.map(({ team, count, pct: teamPct }) => (
              <div className="champion-stat-row" key={team}>
                <div className="champion-stat-name"><TeamFlag team={team} size={16} /> {team}</div>
                <div className="champion-stat-bar-wrap">
                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ width: `${teamPct}%` }} />
                  </div>
                </div>
                <div className="champion-stat-num">{count} · {teamPct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parts.length === 0 ? (
        <div className="card muted section" style={{ textAlign: 'center', padding: 40 }}>
          No participants yet.
        </div>
      ) : (
        <div className="panel section" style={{ overflow: 'hidden' }}>
          <div className="pot-list-head">
            <span className="pot-section-title" style={{ marginBottom: 0 }}>Participants</span>
            <span className="muted small">{parts.length} total · ${fee} each</span>
          </div>
          {parts.map((p) => (
            <div className="pot-list-item" key={p.id}>
              <div>
                <div className="pot-name">{displayName(p.name)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {p.champion ? <><TeamFlag team={p.champion} size={14} /> {p.champion}</> : 'No champion pick'}
                  {' · '}
                  {p.totalGoals != null ? `⚽ ${p.totalGoals} goals` : 'No goals guess'}
                </div>
              </div>
              <span className={`paid-chip ${p.paid ? 'paid-yes' : 'paid-no'}`}>
                {p.paid ? `✓ PAID $${fee}` : `UNPAID $${fee}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
