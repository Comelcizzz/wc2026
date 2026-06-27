'use client';
import { useEffect, useMemo, useState } from 'react';
import Countdown from '@/components/Countdown';
import { getPool, postJSON, type PoolResponse } from '@/lib/clientApi';
import { resolveRealKoTeams } from '@/lib/bracket';
import { TEAMS, KO_MATCH_IDS, KO_META, BRACKET_COLUMNS, GROUPS } from '@/lib/tournament';
import { groupTable } from '@/lib/groupStandings';
import TeamFlag from '@/components/TeamFlag';
import type { Round, MatchResult, Match } from '@/lib/types';

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [secret, setSecret] = useState('');
  const [pool, setPool] = useState<PoolResponse | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  function flash(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function refresh() {
    const p = await getPool();
    if (p.ok) setPool(p);
  }

  useEffect(() => {
    fetch('/api/admin')
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d.authed);
        if (d.authed) refresh();
      });
  }, []);

  async function login() {
    const r = await postJSON('/api/admin/login', { secret });
    if (r.ok) {
      setAuthed(true);
      refresh();
      flash('Admin unlocked', 'ok');
    } else {
      flash(r.error || 'Login failed', 'err');
    }
  }

  async function logout() {
    await postJSON('/api/admin/login', { logout: true });
    setAuthed(false);
    setPool(null);
    flash('Logged out', 'ok');
  }

  async function act(body: any, okMsg = 'Saved') {
    const r = await postJSON('/api/admin', body);
    if (r.ok) {
      flash(okMsg, 'ok');
      refresh();
    } else {
      flash(r.error || 'Failed', 'err');
    }
  }

  if (authed === null) return <div className="card muted">Loading...</div>;

  if (!authed) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Admin login</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Enter the admin secret to manage fixtures, passwords and scoring.
        </p>
        <label className="lbl">Admin secret</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
        />
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={login}>
          Unlock admin
        </button>
        {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      </div>
    );
  }

  if (!pool) return <div className="card muted">Loading pool...</div>;

  const submitted = pool.participants.filter((p) => p.koSubmittedAt).length;

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">Admin console</div>
          <h1>Manage the pool without touching the database.</h1>
          <p>
            Lock the Round of 32, generate player passwords, enter official results and keep the
            leaderboard scoring against the real bracket.
          </p>
          <div className="stat-strip">
            <div className="stat">
              <strong>{pool.participants.length}</strong>
              <span>Players</span>
            </div>
            <div className="stat">
              <strong>{submitted}</strong>
              <span>Brackets submitted</span>
            </div>
            <div className="stat">
              <strong>{pool.koBracket.locked ? 'Open' : 'Setup'}</strong>
              <span>Redraft state</span>
            </div>
          </div>
        </div>
        <Countdown deadline={pool.settings.picksDeadline} />
      </section>

      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
      </div>

      <DeadlineSection pool={pool} act={act} />
      <GroupResultsSection pool={pool} act={act} />
      <BracketConsole pool={pool} act={act} />
      <PasswordsSection pool={pool} refresh={refresh} flash={flash} />
      <ChampionSection pool={pool} act={act} />
      <ParticipantsSection pool={pool} act={act} />

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </>
  );
}

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 className="section-title" style={{ marginBottom: children ? 4 : 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function DeadlineSection({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  const [dt, setDt] = useState('');
  return (
    <div className="card section">
      <SectionTitle title="Deadline & status">
        <p className="muted small">Current: {new Date(pool.settings.picksDeadline).toLocaleString()}</p>
      </SectionTitle>
      <div className="row">
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} style={{ maxWidth: 240 }} />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dt && act({ action: 'extendDeadline', deadline: new Date(dt).toISOString() }, 'Deadline updated')}
        >
          Set deadline
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'extendDeadline', addHours: 1 }, '+1h')}>+1 hour</button>
        <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'extendDeadline', addHours: 24 }, '+1 day')}>+1 day</button>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span className="pill">Status: {pool.settings.status}</span>
        {pool.settings.status === 'open' ? (
          <button className="btn btn-danger btn-sm" onClick={() => act({ action: 'setStatus', status: 'locked' }, 'Locked')}>
            Force lock now
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => act({ action: 'setStatus', status: 'open' }, 'Re-opened')}>
            Re-open
          </button>
        )}
      </div>
    </div>
  );
}

// Native select whose option labels carry the flag, so the chosen value
// shows the flag too (no extra widget needed).
function TeamSelect({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={`team-select-flag${value ? ' has-pick' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {TEAMS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

type ConsoleTab = Round | 'grid';
const CONSOLE_TABS: { key: ConsoleTab; label: string }[] = [
  { key: 'r32', label: 'Round of 32' },
  { key: 'r16', label: 'Round of 16' },
  { key: 'qf', label: 'Quarter-Finals' },
  { key: 'sf', label: 'Semi-Finals' },
  { key: '3rd', label: '3rd Place' },
  { key: 'final', label: 'Final' },
  { key: 'grid', label: '🗺️ Bracket grid' },
];

function GroupResultsSection({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  const groupKeys = Object.keys(GROUPS);
  const [group, setGroup] = useState(groupKeys[0]);
  const matches = pool.matches
    .filter((m) => m.round === 'group' && m.group === group)
    .sort((a, b) => (a.matchday || 0) - (b.matchday || 0));
  const table = useMemo(() => groupTable(group, pool.matches), [group, pool.matches]);
  const played = pool.matches.filter((m) => m.round === 'group' && m.result?.homeGoals != null).length;

  return (
    <div className="card section">
      <SectionTitle title="Group stage results">
        <p className="muted small">
          Enter group scores as matches finish — the live table and standings update instantly.
          <span className="pill" style={{ marginLeft: 8 }}>{played}/72 played</span>
        </p>
      </SectionTitle>

      <div className="round-tabs">
        {groupKeys.map((g) => (
          <button
            key={g}
            type="button"
            className={`round-tab${group === g ? ' active' : ''}`}
            onClick={() => setGroup(g)}
          >
            Group {g}
          </button>
        ))}
      </div>

      <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="group-table">
          <thead>
            <tr>
              <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={row.team} className={i < 2 ? 'qualify' : i === 2 ? 'third' : undefined}>
                <td><span className="gt-pos">{i + 1}</span></td>
                <td className="gt-team"><TeamFlag team={row.team} size={16} />{row.team}</td>
                <td>{row.played}</td><td>{row.win}</td><td>{row.draw}</td><td>{row.loss}</td>
                <td>{row.gf}</td><td>{row.ga}</td>
                <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td className="gt-pts">{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="result-grid">
        {matches.map((m) => (
          <GroupResultRow key={m.id} match={m} act={act} />
        ))}
      </div>
    </div>
  );
}

function GroupResultRow({ match, act }: { match: Match; act: (b: any, m?: string) => void }) {
  const res = match.result;
  const [hg, setHg] = useState(res?.homeGoals != null ? String(res.homeGoals) : '');
  const [ag, setAg] = useState(res?.awayGoals != null ? String(res.awayGoals) : '');
  const dirty = hg !== '' && ag !== '';

  return (
    <div className="result-card">
      <div className="result-card-head">
        <span className="fx-date">{match.date}</span>
        {res?.homeGoals != null && <span className="result-done">✓ {res.homeGoals}:{res.awayGoals}</span>}
      </div>
      <div className="result-score-row">
        <span className="result-side">
          <TeamFlag team={match.home} size={16} />
          <span className="result-side-name">{match.home}</span>
        </span>
        <input type="number" min={0} value={hg} onChange={(e) => setHg(e.target.value)} className="result-score-input" />
        <span className="muted">:</span>
        <input type="number" min={0} value={ag} onChange={(e) => setAg(e.target.value)} className="result-score-input" />
        <span className="result-side right">
          <span className="result-side-name">{match.away}</span>
          <TeamFlag team={match.away} size={16} />
        </span>
      </div>
      <div className="result-actions">
        <button
          className="btn btn-secondary btn-sm"
          disabled={!dirty}
          onClick={() => act({ action: 'setGroupResult', matchId: match.id, homeGoals: hg, awayGoals: ag }, `${match.home} v ${match.away} saved`)}
        >
          Save
        </button>
        {res?.homeGoals != null && (
          <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'clearGroupResult', matchId: match.id }, 'Cleared')}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function BracketConsole({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  const [tab, setTab] = useState<ConsoleTab>('r32');
  const results = useMemo(
    () => Object.fromEntries(pool.matches.map((m) => [m.id, m.result])) as Record<string, MatchResult | undefined>,
    [pool],
  );

  return (
    <div className="card section">
      <SectionTitle title="Bracket console">
        <p className="muted small">
          Set the Round of 32, then enter results round by round — later rounds auto-fill from saved
          winners. Switch to the grid to see the bracket like the FIFA site.
          {pool.koBracket.locked && <span className="pill" style={{ marginLeft: 8 }}>Locked / open to players</span>}
        </p>
      </SectionTitle>

      <div className="round-tabs">
        {CONSOLE_TABS.map((t) => {
          const done = countRoundDone(t.key, pool, results);
          return (
            <button
              key={t.key}
              type="button"
              className={`round-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {done && <span className="round-tab-badge">{done}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'grid' ? (
        <AdminBracketGrid pool={pool} results={results} />
      ) : tab === 'r32' ? (
        <>
          <div className="console-subhead">1 · Set the matchups</div>
          <FixtureEditor pool={pool} act={act} />
          <div className="console-subhead spaced">2 · Enter the scores</div>
          <ResultsEditor pool={pool} act={act} round="r32" results={results} />
        </>
      ) : (
        <ResultsEditor pool={pool} act={act} round={tab} results={results} />
      )}
    </div>
  );
}

// "x/y" results-entered badge, shown on every round tab for consistency.
function countRoundDone(
  tab: ConsoleTab,
  pool: PoolResponse,
  results: Record<string, MatchResult | undefined>,
): string | null {
  if (tab === 'grid') return null;
  const ids = KO_MATCH_IDS.filter((m) => m.round === tab);
  const done = ids.filter((m) => results[m.id]?.winner).length;
  return `${done}/${ids.length}`;
}

function FixtureEditor({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  const initial = useMemo(() => {
    const arr: { id: string; home: string; away: string }[] = [];
    for (let i = 1; i <= 16; i++) {
      const id = `R32-${i}`;
      const ex = pool.koBracket.r32.find((f) => f.id === id);
      arr.push({ id, home: ex?.home || '', away: ex?.away || '' });
    }
    return arr;
  }, [pool]);
  const [rows, setRows] = useState(initial);
  useEffect(() => setRows(initial), [initial]);

  function upd(i: number, side: 'home' | 'away', v: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [side]: v } : row)));
  }

  return (
    <>
      <div className="fixture-grid">
        {rows.map((row, i) => {
          const meta = KO_META[row.id];
          const ready = !!(row.home && row.away);
          return (
            <div className={`fixture-card${ready ? ' ready' : ''}`} key={row.id}>
              <div className="fixture-card-head">
                <span className="fx-m">M{meta?.m ?? row.id}</span>
                <span className="fx-date">{meta?.date}</span>
              </div>
              <TeamSelect value={row.home} onChange={(v) => upd(i, 'home', v)} placeholder="-- home team --" />
              <div className="fx-vs"><span>VS</span></div>
              <TeamSelect value={row.away} onChange={(v) => upd(i, 'away', v)} placeholder="-- away team --" />
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => act({ action: 'setR32', fixtures: rows }, 'Fixtures saved — open to players')}>
          Save fixtures
        </button>
        <span className="muted small" style={{ alignSelf: 'center' }}>
          Players can pick each match as soon as its two teams are set.
        </span>
      </div>
    </>
  );
}

function ResultsEditor({
  pool,
  act,
  round,
  results,
}: {
  pool: PoolResponse;
  act: (b: any, m?: string) => void;
  round: Round;
  results: Record<string, MatchResult | undefined>;
}) {
  const ids = KO_MATCH_IDS.filter((m) => m.round === round);
  return (
    <div className="result-grid">
      {ids.map((m) => (
        <ResultRow key={m.id} pool={pool} matchId={m.id} round={round} results={results} act={act} />
      ))}
    </div>
  );
}

function AdminBracketGrid({
  pool,
  results,
}: {
  pool: PoolResponse;
  results: Record<string, MatchResult | undefined>;
}) {
  return (
    <div className="bracket-scroll admin-grid">
      <div className="bracket-board">
        {BRACKET_COLUMNS.map((col) => (
          <div className={`bracket-col ${col.key}`} key={col.key}>
            <div className="bracket-col-title">{col.title}</div>
            <div className="bracket-stack">
              {col.ids.map((id) => {
                const meta = KO_META[id];
                const res = results[id];
                const teams = id.startsWith('R32-')
                  ? (() => {
                      const fx = pool.koBracket.r32.find((f) => f.id === id);
                      return { home: fx?.home || null, away: fx?.away || null };
                    })()
                  : resolveRealKoTeams(id, results, pool.koBracket) || { home: null, away: null };
                const home = res?.home ?? teams.home;
                const away = res?.away ?? teams.away;
                return (
                  <div className={`bracket-match${res?.winner ? ' decided' : ''}`} key={id}>
                    <div className="bracket-match-meta">
                      <span>M{meta?.m ?? id}</span>
                      <span>{meta?.date?.split('·')[0]?.trim()}</span>
                    </div>
                    <div className={`grid-team-row${res?.winner && res.winner === home ? ' win' : ''}`}>
                      <span className="grid-team">
                        <TeamFlag team={home} size={15} />
                        {home || <span className="tbd">TBD</span>}
                      </span>
                      <span className="grid-score">{res ? res.homeGoals : ''}</span>
                    </div>
                    <div className={`grid-team-row${res?.winner && res.winner === away ? ' win' : ''}`}>
                      <span className="grid-team">
                        <TeamFlag team={away} size={15} />
                        {away || <span className="tbd">TBD</span>}
                      </span>
                      <span className="grid-score">{res ? res.awayGoals : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultRow({
  pool,
  matchId,
  round,
  results,
  act,
}: {
  pool: PoolResponse;
  matchId: string;
  round: Round;
  results: Record<string, MatchResult | undefined>;
  act: (b: any, m?: string) => void;
}) {
  const meta = KO_META[matchId];
  const fixture = pool.koBracket.r32.find((f) => f.id === matchId);
  const res = pool.matches.find((m) => m.id === matchId)?.result;
  const isR32 = round === 'r32';
  const derived = isR32
    ? { home: fixture?.home || '', away: fixture?.away || '' }
    : resolveRealKoTeams(matchId, results, pool.koBracket) || { home: '', away: '' };

  const [home, setHome] = useState(res?.home || derived.home || '');
  const [away, setAway] = useState(res?.away || derived.away || '');
  const [hg, setHg] = useState(res?.homeGoals != null ? String(res.homeGoals) : '');
  const [ag, setAg] = useState(res?.awayGoals != null ? String(res.awayGoals) : '');
  const [winner, setWinner] = useState(res?.winner || '');

  useEffect(() => {
    if (isR32) return;
    if (!home && derived.home) setHome(derived.home);
    if (!away && derived.away) setAway(derived.away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived.home, derived.away]);

  const teamOptions = [home, away].filter(Boolean) as string[];
  const ready = isR32 ? !!(fixture?.home && fixture?.away) : !!(home && away);
  const winnerOptions = isR32 ? ([fixture?.home, fixture?.away].filter(Boolean) as string[]) : teamOptions;
  const displayHome = isR32 ? fixture?.home || '' : home;
  const displayAway = isR32 ? fixture?.away || '' : away;

  return (
    <div className="result-card">
      <div className="result-card-head">
        <span className="fx-m">M{meta?.m ?? matchId}</span>
        <span className="fx-date">{meta?.date}</span>
        {res?.winner && <span className="result-done">✓ <TeamFlag team={res.winner} size={13} /> {res.winner}</span>}
      </div>

      {isR32 ? (
        <div className="result-fixture">
          {fixture?.home && fixture?.away ? (
            <span className="result-fixture-teams">
              <TeamFlag team={fixture.home} size={16} /> {fixture.home} <span className="muted">v</span>{' '}
              <TeamFlag team={fixture.away} size={16} /> {fixture.away}
            </span>
          ) : (
            <span className="tbd">Set this fixture in the Round of 32 tab first</span>
          )}
        </div>
      ) : (
        <div className="result-pickers">
          <TeamSelect value={home} onChange={setHome} placeholder="-- home team --" />
          <TeamSelect value={away} onChange={setAway} placeholder="-- away team --" />
        </div>
      )}

      <div className="result-score-row">
        <span className="result-side">
          <TeamFlag team={displayHome} size={16} />
          <span className="result-side-name">{displayHome || 'TBD'}</span>
        </span>
        <input
          type="number"
          min={0}
          value={hg}
          onChange={(e) => setHg(e.target.value)}
          className="result-score-input"
          disabled={!ready}
        />
        <span className="muted">:</span>
        <input
          type="number"
          min={0}
          value={ag}
          onChange={(e) => setAg(e.target.value)}
          className="result-score-input"
          disabled={!ready}
        />
        <span className="result-side right">
          <span className="result-side-name">{displayAway || 'TBD'}</span>
          <TeamFlag team={displayAway} size={16} />
        </span>
      </div>

      <div className="result-actions">
        <select className="team-select-flag" value={winner} onChange={(e) => setWinner(e.target.value)} disabled={!ready}>
          <option value="">Winner / advances…</option>
          {winnerOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!ready}
          onClick={() =>
            act(
              {
                action: 'setResult',
                matchId,
                home: isR32 ? fixture?.home : home,
                away: isR32 ? fixture?.away : away,
                homeGoals: hg,
                awayGoals: ag,
                winner,
              },
              `${matchId} saved`,
            )
          }
        >
          Save
        </button>
        {res && <button className="btn btn-ghost btn-sm" onClick={() => act({ action: 'clearResult', matchId }, 'Cleared')}>Clear</button>}
      </div>
    </div>
  );
}

function ChampionSection({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  const [champ, setChamp] = useState(pool.settings.champion || '');
  const [tg, setTg] = useState(pool.settings.totalGoals != null ? String(pool.settings.totalGoals) : '');
  return (
    <div className="card section">
      <SectionTitle title="Champion & tiebreaker" />
      <div className="grid2" style={{ maxWidth: 620 }}>
        <div>
          <label className="lbl">Actual champion (+10 bonus)</label>
          <select className="field" value={champ} onChange={(e) => setChamp(e.target.value)}>
            <option value="">-- not decided --</option>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl">Actual total KO goals</label>
          <input type="number" min={0} value={tg} onChange={(e) => setTg(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => act({ action: 'setChampion', champion: champ }, 'Champion set')}>
          Save champion
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => act({ action: 'setTotalGoals', totalGoals: tg }, 'Goals set')}>
          Save total goals
        </button>
      </div>
    </div>
  );
}

function PasswordsSection({
  pool,
  refresh,
  flash,
}: {
  pool: PoolResponse;
  refresh: () => void;
  flash: (m: string, k: 'ok' | 'err') => void;
}) {
  const [creds, setCreds] = useState<{ name: string; password: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(body: any, okMsg: string) {
    setBusy(true);
    const r = await postJSON('/api/admin', body);
    setBusy(false);
    if (!r.ok) {
      flash(r.error || 'Failed', 'err');
      return;
    }
    if (r.credentials?.length) setCreds(r.credentials);
    flash(okMsg, 'ok');
    refresh();
  }

  function copyAll() {
    const text = creds.map((c) => `${c.name}: ${c.password}`).join('\n');
    try {
      navigator.clipboard?.writeText(text);
      flash('Copied', 'ok');
    } catch {
      flash('Copy not available - select manually', 'err');
    }
  }

  return (
    <div className="card section">
      <SectionTitle title="Player passwords">
        <p className="muted small">
          Generate player passwords, copy them once, and send each player their own login.
        </p>
      </SectionTitle>
      <div className="row">
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ action: 'generatePasswords' }, 'Generated for players missing one')}>
          Generate for missing
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            if (confirm('Reset ALL passwords? Everyone will need the new one.')) {
              run({ action: 'generatePasswords', regenerateAll: true }, 'Regenerated all');
            }
          }}
        >
          Reset all
        </button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add new player name" style={{ maxWidth: 240 }} />
        <button
          className="btn btn-secondary btn-sm"
          disabled={busy || !newName.trim()}
          onClick={async () => {
            await run({ action: 'addParticipant', name: newName.trim() }, 'Player added');
            setNewName('');
          }}
        >
          Add player
        </button>
      </div>

      {creds.length > 0 && (
        <div className="credentials-panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>New passwords - copy now, shown once</strong>
            <button className="btn btn-ghost btn-sm" onClick={copyAll}>Copy all</button>
          </div>
          <table className="standings-table" style={{ marginTop: 8 }}>
            <tbody>
              {creds.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}>{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {pool.participants.map((p) => (
          <div className="admin-row" key={p.id}>
            <strong style={{ minWidth: 170, color: 'var(--ink)' }}>{p.name}</strong>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run({ action: 'regeneratePassword', participantId: p.id }, `New password for ${p.name}`)}>
              Reset password
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipantsSection({ pool, act }: { pool: PoolResponse; act: (b: any, m?: string) => void }) {
  return (
    <div className="card section">
      <SectionTitle title={`Participants (${pool.participants.length})`} />
      {pool.participants.map((p) => (
        <div className="admin-row" key={p.id}>
          <strong style={{ minWidth: 150, color: 'var(--ink)' }}>{p.name}</strong>
          <span className="pill">{p.koSubmittedAt ? 'Bracket submitted' : 'No bracket'}</span>
          <label className="row small" style={{ marginLeft: 'auto', gap: 6 }}>
            <input
              type="checkbox"
              checked={p.paid}
              onChange={(e) => act({ action: 'setPaid', participantId: p.id, paid: e.target.checked }, 'Updated')}
            />
            paid
          </label>
        </div>
      ))}
    </div>
  );
}
