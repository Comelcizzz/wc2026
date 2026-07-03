'use client';

import Link from 'next/link';
import { usePool } from '@/lib/usePool';
import { POINTS, ROUND_LABELS } from '@/lib/tournament';

const STEPS = [
  {
    n: 1,
    icon: '💵',
    title: 'Pay your entry',
    body: 'Drop your cash entry in person. Your group-stage points from the original pool carry straight over.',
  },
  {
    n: 2,
    icon: '🗺️',
    title: 'Pick official matchups',
    body: 'Predict exact scores for official knockout matches as the admin opens each round.',
  },
  {
    n: 3,
    icon: '🏆',
    title: 'Climb the standings',
    body: 'Points land as results come in. Most points when the dust settles takes the pot.',
  },
] as const;

export default function HomePage() {
  const { pool, err } = usePool();

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
  const count = pool.participants.length;
  const paid = pool.participants.filter((p) => p.paid).length;
  const paidTotal = paid * fee;
  const fullTotal = count * fee;
  const p1 = Math.floor(paidTotal * (s.prizeFirst || 70) / 100);
  const p2 = Math.floor(paidTotal * (s.prizeSecond || 20) / 100);
  const p3 = Math.floor(paidTotal * (s.prizeThird || 10) / 100);
  const roundCards = [
    { key: 'group', label: 'Group Stage', outcome: 1, exact: 3, note: 'carried over' },
    ...(['r32', 'r16', 'qf', 'sf', '3rd', 'final'] as const).map((r) => ({
      key: r,
      label: ROUND_LABELS[r],
      outcome: POINTS[r].outcome,
      exact: POINTS[r].exact,
      note: '',
    })),
  ];

  return (
    <>
      <section className="rules-hero">
        <div className="rules-hero-glow" aria-hidden />
        <div className="rules-hero-inner">
          <span className="rules-eyebrow">FIFA World Cup 2026 · Knockout Re-Draft</span>
          <h1 className="rules-hero-title">How the Pool Works</h1>
          <p className="rules-hero-sub">
            Group points carry over. Pick scores for official knockout matchups as they open,
            and keep editing each match until its 1-hour kickoff cutoff.
          </p>
          <div className="rules-hero-stats">
            <div className="rules-hero-stat">
              <span className="rhs-value gold">${paidTotal}</span>
              <span className="rhs-label">Prize pool</span>
            </div>
            <div className="rules-hero-stat">
              <span className="rhs-value">{paid}/{count}</span>
              <span className="rhs-label">Paid players</span>
            </div>
            <div className="rules-hero-stat">
              <span className="rhs-value">${fee}</span>
              <span className="rhs-label">Entry fee</span>
            </div>
          </div>
          <div className="rules-hero-actions">
            <Link href="/picks" className="btn btn-primary">Make my picks</Link>
            <Link href="/standings" className="btn btn-ghost">View standings</Link>
          </div>
        </div>
        <div className="rules-hero-countdown">
          <div className={`status-flag ${pool.locked ? 'locked' : 'open'}`}>
            {pool.locked ? '🔒 Emergency stop active' : '🟢 Picks open'}
          </div>
          <div className="card muted small" style={{ marginTop: 10 }}>
            Each match locks 1 hour before kickoff (Toronto time).
          </div>
        </div>
      </section>

      <section className="how-section">
        <div className="steps-grid">
          {STEPS.map((step) => (
            <div className="step-card" key={step.n}>
              <span className="step-num">{step.n}</span>
              <span className="step-icon">{step.icon}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="muted small">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-section">
        <h2 className="section-title">Points Per Round</h2>
        <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>
          Correct winner earns the base points. Nail the exact scoreline (after 90+30 min) for the
          bonus. From the Round of 16 onward your predicted matchup must match the official bracket
          slot before it can score.
        </p>
        <div className="round-cards">
          {roundCards.map((r) => (
            <div className={`round-card${r.key === 'final' ? ' is-final' : ''}`} key={r.key}>
              <div className="round-card-head">
                <span className="round-card-name">{r.label}</span>
                {r.note && <span className="round-card-tag">{r.note}</span>}
              </div>
              <div className="round-card-pts">
                <span className="rc-base">{r.outcome}</span>
                <span className="rc-unit">pts</span>
              </div>
              <div className="round-card-exact">+ {r.exact} pts exact score</div>
            </div>
          ))}
          <div className="round-card is-bonus">
            <div className="round-card-head">
              <span className="round-card-name">Champion Bonus</span>
              <span className="round-card-tag">🏆</span>
            </div>
            <div className="round-card-pts">
              <span className="rc-base">+10</span>
              <span className="rc-unit">pts</span>
            </div>
            <div className="round-card-exact">Pick the WC Champion right</div>
          </div>
        </div>
      </section>

      <section className="how-section">
        <h2 className="section-title">Prize Breakdown</h2>
        <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>
          Based on {paid} paid × ${fee} = <strong style={{ color: 'var(--ink)' }}>${paidTotal}</strong>
          {count > paid && <> · {count - paid} unpaid (${fullTotal - paidTotal} still out)</>}
        </p>
        <div className="prize-podium fancy">
          <div className="prize-slot silver">
            <div className="podium-medal">🥈</div>
            <div className="prize-slot-label">2nd Place</div>
            <div className="prize-slot-value">${p2}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.prizeSecond || 20}%</div>
            <div className="podium-bar h2" />
          </div>
          <div className="prize-slot gold">
            <div className="podium-medal">🥇</div>
            <div className="prize-slot-label">1st Place</div>
            <div className="prize-slot-value">${p1}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.prizeFirst || 70}%</div>
            <div className="podium-bar h1" />
          </div>
          <div className="prize-slot bronze">
            <div className="podium-medal">🥉</div>
            <div className="prize-slot-label">3rd Place</div>
            <div className="prize-slot-value">${p3}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.prizeThird || 10}%</div>
            <div className="podium-bar h3" />
          </div>
        </div>
      </section>

      <section className="how-section">
        <div className="rules-split">
          <div className="card rules-block">
            <h2 className="rules-block-title">⚖️ Tiebreaker</h2>
            <ol className="rules-list">
              <li><strong>Closest total goals guess</strong> — nearest to the actual total goals in the knockout stage</li>
              <li><strong>Most exact scores</strong> — most correctly predicted scorelines</li>
              <li><strong>Earliest submission</strong> — whoever locked their bracket in first</li>
            </ol>
          </div>
          <div className="card rules-block">
            <h2 className="rules-block-title">📋 Rules</h2>
            <ul className="rules-list">
              <li>Each official matchup locks 1 hour before kickoff (Toronto time)</li>
              <li>Every knockout pick needs a score; draws need an ET / penalties winner</li>
              <li>You can edit unlocked matches as often as you want</li>
              <li>Results are entered by the admin as matches are played</li>
              <li>Cash paid in person — ${fee} entry fee</li>
              <li>Rounds open when official matchups are set by the admin</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
