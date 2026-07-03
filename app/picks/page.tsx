'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import ClosingSoonBanner from '@/components/ClosingSoonBanner';
import MatchPickCountdown from '@/components/MatchPickCountdown';
import MatchComments from '@/components/MatchComments';
import { getPool, postJSON, type PoolResponse } from '@/lib/clientApi';
import { getCachedPool } from '@/lib/usePool';
import { resolveRealKoTeams, resultsFromMatches } from '@/lib/bracket';
import { isMatchPickLocked } from '@/lib/matchSchedule';
import { canPickMatch, getMaxOpenPickRound, isRoundAccessible } from '@/lib/roundPick';
import { computeTotalGoals } from '@/lib/tiebreaker';
import { gradeGroupMatch, gradeKoMatch } from '@/lib/scoring';
import { BRACKET_COLUMNS, GROUPS, KO_MATCH_IDS, KO_META, KO_ROUNDS, ROUND_LABELS } from '@/lib/tournament';
import TeamFlag from '@/components/TeamFlag';
import { groupTable } from '@/lib/groupStandings';
import { coolPhrase, displayName } from '@/lib/flair';
import type { KoPicks, GroupPicks, Match, MatchResult, Round } from '@/lib/types';

type Toast = { msg: string; kind: 'ok' | 'err' } | null;
// One tab per round, plus the group stage and the full bracket overview.
type PageTab = 'group' | Round | 'bracket';

const TAB_KEY = 'wc2026_picks_tab';

// Compact labels for the per-round navigation (kept consistent with the
// official FIFA round naming used across the admin and bracket views).
const TAB_LABELS: Record<PageTab, string> = {
  group: 'Groups',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  '3rd': 'Third place',
  final: 'Final',
  bracket: 'Bracket view',
};

// 'bracket' (the full-tree BracketBoard) is intentionally omitted from the
// visible navigation for now. The component + its render branch are kept below
// so the tab can be re-enabled later by re-adding it here.
const PAGE_TABS: PageTab[] = ['group', ...KO_ROUNDS];

function isKoRoundTab(tab: PageTab): tab is Round {
  return tab !== 'group' && tab !== 'bracket';
}

export default function PicksPage() {
  const [pool, setPool] = useState<PoolResponse | null>(() => getCachedPool());
  const [name, setName] = useState('');
  const [identified, setIdentified] = useState(false);
  const [koPicks, setKoPicks] = useState<KoPicks>({});
  // Explicit champion pick for the +10 bonus — independent of the bracket final.
  const [champion, setChampion] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [saving, setSaving] = useState(false);
  // Default to a per-round view (Round of 32); the full tree is its own tab.
  const [pageTab, setPageTab] = useState<PageTab>('r32');
  // True until we've checked the session cookie, so we don't flash the login card.
  const [idChecking, setIdChecking] = useState(true);
  const lastLockToastAt = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved && (PAGE_TABS as string[]).includes(saved)) setPageTab(saved as PageTab);
    } catch {}
  }, []);

  function flash(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  function flashLock(msg: string) {
    const t = Date.now();
    if (t - lastLockToastAt.current < 3000) return;
    lastLockToastAt.current = t;
    flash(msg, 'err');
  }

  function switchTab(next: PageTab) {
    setPageTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {}
  }

  useEffect(() => {
    getPool().then((p) => p.ok && setPool(p));
  }, []);

  useEffect(() => {
    if (!pool || identified) return;
    (async () => {
      try {
        const r = await fetch('/api/login', { cache: 'no-store' }).then((x) => x.json());
        if (r?.name) {
          loadAndEnter(r.name);
          return;
        }
      } catch {}
      if (!name) {
        try {
          let remembered = localStorage.getItem('wc2026_v2_name') || '';
          if (!remembered) {
            const legacy = localStorage.getItem('wc2026_draft_meta');
            if (legacy) remembered = String(JSON.parse(legacy)?.name || '');
          }
          if (remembered) setName(remembered);
        } catch {}
      }
      setIdChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  function loadAndEnter(rawName: string) {
    const existing = pool?.participants.find(
      (p) => p.name.trim().toLowerCase() === rawName.trim().toLowerCase(),
    );
    const finalName = existing ? existing.name : rawName.trim();
    setName(finalName);
    if (existing?.koPicks) setKoPicks(existing.koPicks);
    if (existing?.champion) setChampion(existing.champion);
    try {
      localStorage.setItem('wc2026_v2_name', finalName);
    } catch {}
    setIdentified(true);
  }

  async function login() {
    const trimmed = name.trim();
    if (!trimmed || !password) return flash('Enter your name and password.', 'err');
    setLoggingIn(true);
    const r = await postJSON('/api/login', { name: trimmed, password });
    setLoggingIn(false);
    if (!r.ok) return flash(r.error || 'Login failed.', 'err');
    const fresh = await getPool();
    if (fresh.ok) setPool(fresh);
    loadAndEnter(r.name || trimmed);
    setPassword('');
    flash(`Welcome back, ${displayName(r.name || trimmed)}!`, 'ok');
  }

  async function logout() {
    await postJSON('/api/login', { logout: true });
    setIdentified(false);
    setKoPicks({});
    setPassword('');
    flash('Logged out.', 'ok');
  }

  const bracket = pool?.koBracket;
  const koResultsMap = useMemo(
    () => (pool ? resultsFromMatches(pool.matches) : {}),
    [pool],
  );
  const maxOpenRound = pool ? getMaxOpenPickRound(pool.koBracket, koResultsMap) : 'r32';
  const adminLocked = pool?.settings.status === 'locked';
  const resolved = useMemo(() => {
    const map: Record<string, { home: string | null; away: string | null } | null> = {};
    if (!bracket) return map;
    for (const m of KO_MATCH_IDS) {
      map[m.id] = resolveRealKoTeams(m.id, koResultsMap, bracket);
    }
    return map;
  }, [bracket, koResultsMap]);

  function setScore(id: string, side: 'h' | 'a', val: string) {
    if (!pool || adminLocked) return;
    if (!canPickMatch(id, pool.koBracket, koResultsMap)) {
      if (isMatchPickLocked(id)) {
        flashLock('This match is locked — less than 1 hour to kickoff (Toronto time).');
      }
      return;
    }
    setKoPicks((prev) => {
      const cur = { ...(prev[id] || { h: NaN, a: NaN }) } as any;
      cur[side] = val === '' ? NaN : Math.max(0, parseInt(val, 10));
      if (!(Number.isInteger(cur.h) && Number.isInteger(cur.a) && cur.h === cur.a)) delete cur.et;
      const next = { ...prev };
      // Once both score boxes are empty the prediction is gone — drop it from
      // state so it isn't kept (and so it's absent from the next save).
      if (!Number.isInteger(cur.h) && !Number.isInteger(cur.a)) delete next[id];
      else next[id] = cur;
      return next;
    });
  }

  function setEt(id: string, team: string) {
    if (!pool || adminLocked) return;
    if (!canPickMatch(id, pool.koBracket, koResultsMap)) {
      if (isMatchPickLocked(id)) flashLock('This match is locked — less than 1 hour to kickoff (Toronto time).');
      return;
    }
    setKoPicks((prev) => ({ ...prev, [id]: { ...(prev[id] as any), et: team } }));
  }

  // Persists exactly the picks passed in. The server replaces the player's full
  // koPicks set, so anything omitted here (e.g. an emptied match) is removed,
  // and it derives totalGoals + champion itself.
  async function persist(picks: KoPicks, successMsg: string) {
    setSaving(true);
    const res = await postJSON('/api/picks', {
      name: name.trim(),
      koPicks: picks,
      champion: champion || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setKoPicks(picks);
      flash(successMsg, 'ok');
      getPool().then((p) => p.ok && setPool(p));
    } else {
      flash(res.error || 'Submit failed.', 'err');
    }
  }

  async function submit() {
    // Only fully-filled matches are saved; emptied/partial picks are dropped.
    const clean = cleanKoPicks(koPicks);
    if (Object.keys(clean).length === 0) {
      return flash('Fill in at least one open match first.', 'err');
    }
    await persist(clean, 'Saved. You can edit any unlocked match until its 1-hour cutoff.');
  }

  async function clearAll() {
    if (Object.keys(koPicks).length === 0) {
      return flash('You have no knockout picks to clear.', 'err');
    }
    if (!window.confirm('Clear ALL your knockout picks? Your group-stage picks stay untouched.')) {
      return;
    }
    await persist({}, 'Knockout picks cleared.');
  }

  if (!pool) return <div className="card muted">Loading...</div>;

  const filled = KO_MATCH_IDS.filter((m) => koPicks[m.id] != null).length;
  // Incremental open: each match is bettable as soon as its teams exist;
  // the board appears once any R32 fixture has both teams set.
  const bracketOpen = pool.koBracket.r32.some((f) => f.home && f.away);
  const me = identified
    ? pool.participants.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
    : undefined;
  const myGroupPicks: GroupPicks = (me?.picks as GroupPicks) || {};
  const groupMatches = pool.matches.filter((m) => m.round === 'group');

  // Tiebreaker is derived live from the shared helper (the same one the server
  // uses): group-stage goals in the player's picks + their knockout-pick goals.
  const autoTotalGoals = computeTotalGoals(myGroupPicks, koPicks);
  const availableMatches = KO_MATCH_IDS.filter((m) => {
    if (!isRoundAccessible(m.round, pool.koBracket, koResultsMap)) return false;
    const teams = resolved[m.id];
    return !!(teams?.home && teams?.away);
  });
  const pickableMatchIds = KO_MATCH_IDS.filter((m) => canPickMatch(m.id, pool.koBracket, koResultsMap)).map((m) => m.id);
  const availablePicked = availableMatches.filter((m) => hasCompleteKoPick(koPicks[m.id])).length;
  const openMissing = availableMatches.filter((m) => canPickMatch(m.id, pool.koBracket, koResultsMap) && !hasCompleteKoPick(koPicks[m.id]));

  // Real knockout results the admin has entered, keyed by match id. Drives the
  // per-match results strip and the points summary.
  const koResults: Record<string, MatchResult> = {};
  for (const m of pool.matches) {
    if (m.round !== 'group' && m.result && m.result.winner) koResults[m.id] = m.result;
  }

  // Points the logged-in player has earned so far, computed with the SAME
  // graders the standings use (single source of truth for the rules).
  const groupPts = groupMatches.reduce(
    (s, m) => s + gradeGroupMatch(myGroupPicks[m.id], m.result).points,
    0,
  );
  const koPtsByRound = KO_ROUNDS.map((r) => ({
    round: r,
    pts: KO_MATCH_IDS.filter((m) => m.round === r).reduce(
      (s, m) => s + gradeKoMatch(r, koPicks[m.id], resolved[m.id] || null, koResults[m.id]).points,
      0,
    ),
  }));
  const championBonus =
    pool.settings.champion && me?.champion === pool.settings.champion ? 10 : 0;
  const overallPts = groupPts + koPtsByRound.reduce((s, r) => s + r.pts, 0) + championBonus;
  const hasAnyResult =
    Object.keys(koResults).length > 0 ||
    groupMatches.some((m) => m.result && m.result.homeGoals != null);

  // A round is "complete" when every match whose teams are known has a full
  // pick (draws also need an ET winner). Drives the "next stage" button.
  const roundComplete = (round: Round) => {
    const ms = KO_MATCH_IDS.filter((m) => m.round === round);
    const ready = ms.filter((m) => {
      const t = resolved[m.id];
      return t?.home && t?.away;
    });
    if (ready.length === 0) return false;
    return ready.every((m) => {
      const p = koPicks[m.id];
      return p && Number.isInteger(p.h) && Number.isInteger(p.a) && (p.h !== p.a || !!p.et);
    });
  };
  const currentRoundComplete =
    pageTab !== 'group' && pageTab !== 'bracket' && roundComplete(pageTab);
  const tabIdx = PAGE_TABS.indexOf(pageTab);
  const nextTab = tabIdx >= 0 && tabIdx < PAGE_TABS.length - 1 ? PAGE_TABS[tabIdx + 1] : null;

  return (
    <div className="picks-page">
      <section className="picks-toolbar">
        <div className="picks-title-block">
          <div className="eyebrow">My bracket</div>
          <h1>Knockout picks</h1>
          <p>{coolPhrase(name || 'wc')} Pick scores for official matchups before each match locks.</p>
        </div>
        <div className="picks-metrics">
          <div className="metric mini">
            <div className="label">Available</div>
            <div className="value">{availablePicked}/{availableMatches.length}</div>
          </div>
          <div className="metric mini">
            <div className="label">Player</div>
            <div className="value text-fit">{identified ? displayName(name) : 'Login'}</div>
          </div>
          <div className="metric mini">
            <div className="label">Status</div>
            <div className="value">{adminLocked ? 'Stopped' : bracketOpen ? 'Open' : 'Setup'}</div>
          </div>
        </div>
      </section>

      {identified && bracketOpen && (
        <ClosingSoonBanner
          nowIso={pool.now}
          maxRound={maxOpenRound}
          matchIds={pickableMatchIds}
          koPicks={koPicks}
        />
      )}

      {!identified ? (
        idChecking ? (
          <div className="card muted" style={{ textAlign: 'center', padding: 36 }}>
            Checking your session…
          </div>
        ) : (
          <section className="login-shell">
            <LoginCard
              pool={pool}
              name={name}
              password={password}
              loggingIn={loggingIn}
              setName={setName}
              setPassword={setPassword}
              login={login}
            />
          </section>
        )
      ) : (
        <>
          <SessionCard name={name} filled={filled} logout={logout} />
          <PickAvailabilitySummary
            available={availableMatches.length}
            picked={availablePicked}
            missing={openMissing}
            resolved={resolved}
          />

          <div className="page-tabs scrollable">
            {PAGE_TABS.map((tab) => {
              const koTab = tab !== 'group' && tab !== 'bracket';
              const accessible = !koTab || isRoundAccessible(tab as Round, pool.koBracket, koResultsMap);
              return (
              <button
                key={tab}
                type="button"
                className={`page-tab${pageTab === tab ? ' active' : ''}${koTab && !accessible ? ' round-closed' : ''}`}
                onClick={() => switchTab(tab)}
              >
                {TAB_LABELS[tab]}
                {tab === maxOpenRound && koTab && <span className="page-tab-live">open</span>}
              </button>
            );})}
          </div>

          {hasAnyResult && (
            <PointsSummary
              groupPts={groupPts}
              koPtsByRound={koPtsByRound}
              championBonus={championBonus}
              overallPts={overallPts}
            />
          )}

          {pageTab === 'group' ? (
            <GroupPicksView matches={groupMatches} picks={myGroupPicks} />
          ) : !bracketOpen && !adminLocked ? (
            <div className="card">
              <strong>The knockout bracket is not open yet.</strong>
              <p className="muted small" style={{ marginTop: 6 }}>
                Matches open for picks as soon as the admin sets the teams. Check back shortly — your
                Group Stage picks are already in the other tab.
              </p>
            </div>
          ) : (
            <>
              {adminLocked && (
                <div className="card">
                  <strong>Emergency Stop is active. All picks are locked by the admin.</strong>
                </div>
              )}

              {isKoRoundTab(pageTab) && !isRoundAccessible(pageTab, pool.koBracket, koResultsMap) && !adminLocked && (
                <div className="card muted">
                  <strong>{TAB_LABELS[pageTab]} is not open yet</strong>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    This round opens when every prior round has official matchups and the admin sets at
                    least one full official match here. You can currently pick through <strong>{ROUND_LABELS[maxOpenRound]}</strong>.
                  </p>
                </div>
              )}

              {isKoRoundTab(pageTab) && isRoundAccessible(pageTab, pool.koBracket, koResultsMap) && !adminLocked && (
                <div className="card repick-banner">
                  <strong>Available: {ROUND_LABELS.r32} → {ROUND_LABELS[maxOpenRound]}</strong>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    You can go back to earlier rounds while individual matches are still open. Each match locks
                    exactly 1 hour before kickoff (Toronto time).
                  </p>
                </div>
              )}

              {pageTab === 'bracket' ? (
                <BracketBoard resolved={resolved} koPicks={koPicks} setScore={setScore} setEt={setEt} />
              ) : (
                <RoundView
                  round={pageTab}
                  resolved={resolved}
                  koPicks={koPicks}
                  setScore={setScore}
                  setEt={setEt}
                  results={koResults}
                  adminLocked={adminLocked}
                  pool={pool}
                  koResultsMap={koResultsMap}
                  identified={identified}
                />
              )}

              {!adminLocked && currentRoundComplete && nextTab && isKoRoundTab(pageTab) &&
                (nextTab === 'group' || isKoRoundTab(nextTab) && isRoundAccessible(nextTab, pool.koBracket, koResultsMap)) && (
                <div className="next-stage-bar">
                  <span>All {TAB_LABELS[pageTab]} matches picked.</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => switchTab(nextTab)}>
                    Next: {TAB_LABELS[nextTab]} →
                  </button>
                </div>
              )}

              <div className="champion-card">
                <div>
                  <div className="lbl" style={{ marginBottom: 2 }}>Champion · +10 bonus</div>
                  <p className="muted small" style={{ margin: 0 }}>
                    Champion picks are closed and cannot be changed.
                  </p>
                </div>
                <div className="champion-pick">
                  {champion && <TeamFlag team={champion} size={20} />}
                  <span className="pill">{champion || 'No champion pick saved'}</span>
                </div>
              </div>

              <div className="tiebreaker-card">
                <div>
                  <div className="lbl" style={{ marginBottom: 2 }}>Tiebreaker · total goals (group + knockout)</div>
                  <p className="muted small" style={{ margin: 0 }}>
                    Adds up automatically from every score you predict.
                  </p>
                </div>
                <span className="tiebreaker-value">{autoTotalGoals}</span>
              </div>

              {!adminLocked && (
                <div className="row sticky-submit">
                  <button className="btn btn-primary" onClick={submit} disabled={saving}>
                    {saving ? 'Saving...' : 'Submit / update picks'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={saving}>
                    Clear all
                  </button>
                  <span className="muted small">
                    Save any time — each match locks 1 hour before kickoff. Pick a few rounds now and finish later.
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

function LoginCard({
  pool,
  name,
  password,
  loggingIn,
  setName,
  setPassword,
  login,
}: {
  pool: PoolResponse;
  name: string;
  password: string;
  loggingIn: boolean;
  setName: (v: string) => void;
  setPassword: (v: string) => void;
  login: () => void;
}) {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 className="section-title" style={{ marginBottom: 6 }}>Player login</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Use your pool name and the password the admin sent you. Your group-stage points stay attached
        to this account.
      </p>
      {pool.participants.length > 0 && (
        <div className="name-grid" style={{ marginBottom: 14 }}>
          {pool.participants.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`name-chip${name.trim().toLowerCase() === p.name.trim().toLowerCase() ? ' sel' : ''}`}
              onClick={() => setName(p.name)}
            >
              {displayName(p.name)}
            </button>
          ))}
        </div>
      )}
      <label className="lbl">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. James Jamil" />
      <label className="lbl" style={{ marginTop: 12 }}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && login()}
        placeholder="Sent by the admin"
      />
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={login} disabled={loggingIn}>
        {loggingIn ? 'Logging in...' : 'Log in'}
      </button>
    </div>
  );
}

function SessionCard({
  name,
  filled,
  logout,
}: {
  name: string;
  filled: number;
  logout: () => void;
}) {
  return (
    <div className="card section row" style={{ justifyContent: 'space-between' }}>
      <div>
        <span className="muted small">Logged in as</span>
        <div style={{ color: 'var(--ink)', fontWeight: 900, fontSize: 18 }}>{displayName(name)}</div>
      </div>
      <div className="row">
        <span className="pill">{filled}/{KO_MATCH_IDS.length} filled</span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}

function PickAvailabilitySummary({
  available,
  picked,
  missing,
  resolved,
}: {
  available: number;
  picked: number;
  missing: { id: string; round: Round; label: string }[];
  resolved: Record<string, { home: string | null; away: string | null } | null>;
}) {
  return (
    <div className="card section pick-availability">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong>Available official picks</strong>
          <p className="muted small" style={{ marginTop: 4 }}>
            {picked}/{available} picks saved for official matchups currently available to you.
          </p>
        </div>
        <span className={`pill${missing.length === 0 ? ' success' : ''}`}>
          {missing.length === 0 ? 'All caught up' : `${missing.length} missing`}
        </span>
      </div>
      {missing.length > 0 && (
        <div className="missing-picks">
          {missing.slice(0, 6).map((m) => {
            const teams = resolved[m.id];
            return (
              <span className="missing-pick-chip" key={m.id}>
                {ROUND_LABELS[m.round]} · {teams?.home || 'TBD'} v {teams?.away || 'TBD'}
              </span>
            );
          })}
          {missing.length > 6 && <span className="muted small">+{missing.length - 6} more</span>}
        </div>
      )}
    </div>
  );
}

// Keeps only fully-filled matches (both score boxes are integers). Emptied or
// half-typed picks are dropped so the save removes them server-side.
function cleanKoPicks(picks: KoPicks): KoPicks {
  const out: KoPicks = {};
  for (const [id, p] of Object.entries(picks)) {
    if (p && Number.isInteger(p.h) && Number.isInteger(p.a)) {
      out[id] = p.h === p.a && p.et ? { h: p.h, a: p.a, et: p.et } : { h: p.h, a: p.a };
    }
  }
  return out;
}

function hasCompleteKoPick(pick: KoPicks[string] | undefined): boolean {
  return !!pick && Number.isInteger(pick.h) && Number.isInteger(pick.a) && (pick.h !== pick.a || !!pick.et);
}

// Maps a shared grade status to the existing result CSS suffix + label.
function gradeChrome(status: ReturnType<typeof gradeKoMatch>['status'], points: number) {
  if (status === 'exact') return { cls: 'exact', txt: `Exact +${points}` };
  if (status === 'correct') return { cls: 'correct', txt: `Outcome +${points}` };
  if (status === 'miss') return { cls: 'wrong', txt: 'Miss' };
  if (status === 'nopick') return { cls: '', txt: 'No pick' };
  return { cls: '', txt: '' };
}

// Display wrapper around the shared group grader so the colored row styling and
// the "+pts" copy stay consistent with the rest of the page.
function gradeGroup(
  pick: { h: number; a: number } | undefined,
  res: Match['result'],
): { cls: string; txt: string } {
  const g = gradeGroupMatch(pick, res);
  if (g.status === 'pending' || g.status === 'nopick') return { cls: '', txt: '' };
  if (g.status === 'miss') return { cls: 'wrong', txt: 'Miss' };
  if (g.status === 'exact') return { cls: 'exact', txt: `Exact +${g.points}` };
  return { cls: 'correct', txt: `+${g.points}` };
}

function PointsSummary({
  groupPts,
  koPtsByRound,
  championBonus,
  overallPts,
}: {
  groupPts: number;
  koPtsByRound: { round: Round; pts: number }[];
  championBonus: number;
  overallPts: number;
}) {
  return (
    <div className="card section points-summary">
      <div className="points-summary-head">
        <strong>Your points so far</strong>
        <span className="pill points-total">{overallPts} pts</span>
      </div>
      <div className="points-chips">
        <span className="points-chip">
          <span className="pc-label">Group stage</span>
          <span className="pc-val">+{groupPts}</span>
        </span>
        {koPtsByRound.map((r) => (
          <span className="points-chip" key={r.round}>
            <span className="pc-label">{ROUND_LABELS[r.round]}</span>
            <span className="pc-val">+{r.pts}</span>
          </span>
        ))}
        {championBonus > 0 && (
          <span className="points-chip">
            <span className="pc-label">Champion</span>
            <span className="pc-val">+{championBonus}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function GroupPicksView({ matches, picks }: { matches: Match[]; picks: GroupPicks }) {
  const groupKeys = Object.keys(GROUPS);
  const [group, setGroup] = useState(groupKeys[0]);

  const groupMatches = useMemo(
    () =>
      matches
        .filter((m) => m.group === group)
        .sort((a, b) => (a.matchday || 0) - (b.matchday || 0)),
    [matches, group],
  );
  const table = useMemo(() => groupTable(group, matches), [group, matches]);

  const total = matches.length;
  const made = matches.filter((m) => {
    const p = picks[m.id];
    return p && p.h != null && p.a != null;
  }).length;
  const played = groupMatches.filter((m) => m.result && m.result.homeGoals != null).length;

  return (
    <section className="group-picks">
      <div className="card section row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>Your group-stage picks</strong>
          <p className="muted small" style={{ marginTop: 2 }}>
            {coolPhrase(group)} · {made}/{total} predicted · scores update live as matches finish.
          </p>
        </div>
        <span className="pill">{made}/{total}</span>
      </div>

      <div className="group-nav">
        {groupKeys.map((g) => (
          <button
            key={g}
            type="button"
            className={`group-nav-btn${group === g ? ' active' : ''}`}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="card section">
        <div className="group-block-head">
          <h3>Group {group}</h3>
          <span className="muted small">{played}/{groupMatches.length} matches played</span>
        </div>

        <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="group-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th className="hide-sm">GF</th>
                <th className="hide-sm">GA</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.team} className={i < 2 ? 'qualify' : i === 2 ? 'third' : undefined}>
                  <td><span className="gt-pos">{i + 1}</span></td>
                  <td className="gt-team">
                    <TeamFlag team={row.team} size={16} />
                    {row.team}
                  </td>
                  <td>{row.played}</td>
                  <td>{row.win}</td>
                  <td>{row.draw}</td>
                  <td>{row.loss}</td>
                  <td className="hide-sm">{row.gf}</td>
                  <td className="hide-sm">{row.ga}</td>
                  <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td className="gt-pts">{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginBottom: 16 }}>
          <span className="legend-dot qualify" /> Top 2 advance
          <span className="legend-dot third" style={{ marginLeft: 14 }} /> 3rd — best 8 also advance
        </p>

        <div className="group-matches">
          {groupMatches.map((m) => {
            const pick = picks[m.id];
            const grade = gradeGroup(pick, m.result);
            const playedM = m.result && m.result.homeGoals != null;
            return (
              <div className={`gp-row${grade.cls ? ` line-${grade.cls}` : ''}`} key={m.id}>
                <span className="gp-date">{m.date}</span>
                <span className="gp-team home">
                  <TeamFlag team={m.home} size={15} />
                  {m.home}
                </span>
                <span className="gp-pred">{pick ? `${pick.h} : ${pick.a}` : '– : –'}</span>
                <span className="gp-team away">
                  {m.away}
                  <TeamFlag team={m.away} size={15} className="right" />
                </span>
                {playedM ? (
                  <span className={`gp-actual ${grade.cls}`}>
                    {m.result!.homeGoals}:{m.result!.awayGoals}
                    {grade.txt && <em> {grade.txt}</em>}
                  </span>
                ) : (
                  <span className="gp-actual scheduled">Upcoming</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RoundView({
  round,
  resolved,
  koPicks,
  setScore,
  setEt,
  results,
  adminLocked,
  pool,
  koResultsMap,
  identified,
}: {
  round: Round;
  resolved: Record<string, { home: string | null; away: string | null } | null>;
  koPicks: KoPicks;
  setScore: (id: string, side: 'h' | 'a', v: string) => void;
  setEt: (id: string, team: string) => void;
  results: Record<string, MatchResult>;
  adminLocked: boolean;
  pool: PoolResponse;
  koResultsMap: Record<string, MatchResult | undefined>;
  identified: boolean;
}) {
  const matches = useMemo(() => KO_MATCH_IDS.filter((m) => m.round === round), [round]);
  const ready = matches.filter((m) => {
    const t = resolved[m.id];
    return t?.home && t?.away;
  }).length;

  const picked = matches.filter((m) => {
    const p = koPicks[m.id];
    return p && Number.isInteger(p.h) && Number.isInteger(p.a);
  }).length;

  return (
    <section className="bracket-list">
      <div className="ko-round">
        <div className="ko-round-head">
          <h3 className="ko-round-name">{ROUND_LABELS[round]}</h3>
          {ready > 0 && (
            <span className={`ko-round-count${picked >= ready ? ' done' : ''}`}>
              {picked} / {ready} picked
            </span>
          )}
        </div>
        {ready === 0 ? (
          <div className="card muted" style={{ padding: 24 }}>
            No official matchups are ready in this round yet.
          </div>
        ) : (
          <div className="matches-grid">
            {matches.map((match) => (
              <ListMatchCard
                key={match.id}
                match={match}
                teams={resolved[match.id]}
                pick={koPicks[match.id]}
                setScore={setScore}
                setEt={setEt}
                result={results[match.id]}
                pickable={!adminLocked && canPickMatch(match.id, pool.koBracket, koResultsMap)}
                identified={identified}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ListMatchCard({
  match,
  teams,
  pick,
  setScore,
  setEt,
  result,
  pickable,
  identified,
}: {
  match: { id: string; round: Round; label: string };
  teams: { home: string | null; away: string | null } | null;
  pick: KoPicks[string];
  setScore: (id: string, side: 'h' | 'a', v: string) => void;
  setEt: (id: string, team: string) => void;
  result?: MatchResult;
  pickable?: boolean;
  identified?: boolean;
}) {
  const home = teams?.home;
  const away = teams?.away;
  const ready = !!home && !!away;
  const matchLocked = isMatchPickLocked(match.id);
  const locked = !pickable || !ready;
  const isDraw = pick && Number.isInteger(pick.h) && Number.isInteger(pick.a) && pick.h === pick.a;
  const meta = KO_META[match.id];
  const graded =
    result && result.winner ? gradeChrome(gradeKoMatch(match.round, pick, teams ?? null, result).status, 0).cls : '';

  return (
    <div className={`match-card${!ready ? ' locked' : ''}${matchLocked ? ' match-pick-closed' : ''}${graded ? ` graded-${graded}` : ''}`}>
      <div className="match-meta">
        <span>M{meta?.m ?? match.id}</span>
        <span>{meta?.date}</span>
        {ready && <MatchPickCountdown matchId={match.id} />}
      </div>
      <div className="score-row">
        <span className={`team-name${!home ? ' tbd' : ''}`}>
          {home ? <><TeamFlag team={home} size={16} />{home}</> : <><TeamFlag team={null} size={16} />TBD</>}
        </span>
        <input
          className={`score-input${pick && Number.isInteger(pick.h) ? ' filled' : ''}`}
          type="number"
          min={0}
          disabled={locked}
          value={pick && Number.isInteger(pick.h) ? pick.h : ''}
          onChange={(e) => setScore(match.id, 'h', e.target.value)}
        />
        <span className="muted" style={{ fontWeight: 900 }}>:</span>
        <input
          className={`score-input${pick && Number.isInteger(pick.a) ? ' filled' : ''}`}
          type="number"
          min={0}
          disabled={locked}
          value={pick && Number.isInteger(pick.a) ? pick.a : ''}
          onChange={(e) => setScore(match.id, 'a', e.target.value)}
        />
        <span className={`team-name right${!away ? ' tbd' : ''}`}>
          {away ? <>{away}<TeamFlag team={away} size={16} className="right" /></> : <>TBD<TeamFlag team={null} size={16} className="right" /></>}
        </span>
      </div>
      {!ready && <div className="ko-not-ready">Waiting for official teams</div>}
      {ready && matchLocked && (
        <div className="ko-not-ready urgent">This match is locked — less than 1 hour to kickoff (Toronto time)</div>
      )}
      {ready && isDraw && (
        <div className="et-row">
          <span className="muted">ET / pens winner</span>
          <div>
            <button className={`et-btn${pick?.et === home ? ' sel' : ''}`} disabled={locked} onClick={() => setEt(match.id, home!)}>
              {home}
            </button>
            <button className={`et-btn${pick?.et === away ? ' sel' : ''}`} disabled={locked} onClick={() => setEt(match.id, away!)}>
              {away}
            </button>
          </div>
        </div>
      )}
      <KoResultStrip match={match} teams={teams} pick={pick} result={result} />
      <MatchComments matchId={match.id} identified={!!identified} />
    </div>
  );
}

// Read-only strip shown once the admin has entered the real result for a KO
// match: the real teams + score, plus how the player did and the points earned.
function KoResultStrip({
  match,
  teams,
  pick,
  result,
}: {
  match: { id: string; round: Round };
  teams: { home: string | null; away: string | null } | null;
  pick: KoPicks[string];
  result?: MatchResult;
}) {
  if (!result || !result.winner || result.homeGoals == null || result.awayGoals == null) return null;
  const grade = gradeKoMatch(match.round, pick, teams ?? null, result);
  const { cls, txt } = gradeChrome(grade.status, grade.points);
  return (
    <div className={`ko-result${cls ? ` line-${cls}` : ''}`}>
      <span className="ko-result-score">
        {result.home} <strong>{result.homeGoals}–{result.awayGoals}</strong> {result.away}
      </span>
      {txt && <span className={`result-badge ${cls}`}>{txt}</span>}
    </div>
  );
}

function BracketBoard({
  resolved,
  koPicks,
  setScore,
  setEt,
}: {
  resolved: Record<string, { home: string | null; away: string | null } | null>;
  koPicks: KoPicks;
  setScore: (id: string, side: 'h' | 'a', v: string) => void;
  setEt: (id: string, team: string) => void;
}) {
  const byId = Object.fromEntries(KO_MATCH_IDS.map((m) => [m.id, m]));
  return (
    <section className="bracket-shell">
      <div className="bracket-head">
        <div>
          <h2 className="section-title">Knockout stage</h2>
          <p className="muted small">Official M73-M104 flow. Matchups appear after the admin confirms them.</p>
        </div>
        <span className="pill">R32 to Final</span>
      </div>
      <div className="bracket-scroll">
        <div className="bracket-board">
          {BRACKET_COLUMNS.map((col) => (
            <div className={`bracket-col ${col.key}`} key={col.key}>
              <div className="bracket-col-title">{col.title}</div>
              <div className="bracket-stack">
                {col.ids.map((id) => (
                  <BracketMatch
                    key={id}
                    match={byId[id]}
                    teams={resolved[id]}
                    pick={koPicks[id]}
                    setScore={setScore}
                    setEt={setEt}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BracketMatch({
  match,
  teams,
  pick,
  setScore,
  setEt,
}: {
  match: { id: string; label: string };
  teams: { home: string | null; away: string | null } | null;
  pick: KoPicks[string];
  setScore: (id: string, side: 'h' | 'a', v: string) => void;
  setEt: (id: string, team: string) => void;
}) {
  const home = teams?.home;
  const away = teams?.away;
  const ready = !!home && !!away;
  const hFilled = !!pick && Number.isInteger(pick.h);
  const aFilled = !!pick && Number.isInteger(pick.a);
  const isDraw = hFilled && aFilled && pick!.h === pick!.a;
  // Winner side drives the FIFA-style green highlight on the advancing team.
  let winSide: 'h' | 'a' | null = null;
  if (hFilled && aFilled) {
    if (pick!.h! > pick!.a!) winSide = 'h';
    else if (pick!.a! > pick!.h!) winSide = 'a';
    else if (pick?.et) winSide = pick.et === home ? 'h' : 'a';
  }
  const meta = KO_META[match.id];

  return (
    <div className={`bracket-match${!ready ? ' locked' : ''}`}>
      <div className="bracket-match-meta">
        <span>M{meta?.m ?? match.id}</span>
        <span>{meta?.date}</span>
      </div>
      <div className="bracket-cards">
        <div className={`bk-card${winSide === 'h' ? ' win' : ''}${!home ? ' tbd' : ''}`}>
          <span className={`bracket-team${!home ? ' unknown' : ''}`}>
            {home ? <><TeamFlag team={home} size={15} />{home}</> : <><TeamFlag team={null} size={15} />TBD</>}
          </span>
          <input
            className={`bracket-score${hFilled ? ' filled' : ''}`}
            type="number"
            min={0}
            disabled={!ready}
            value={hFilled ? pick!.h : ''}
            onChange={(e) => setScore(match.id, 'h', e.target.value)}
          />
        </div>
        <div className={`bk-card${winSide === 'a' ? ' win' : ''}${!away ? ' tbd' : ''}`}>
          <span className={`bracket-team${!away ? ' unknown' : ''}`}>
            {away ? <><TeamFlag team={away} size={15} />{away}</> : <><TeamFlag team={null} size={15} />TBD</>}
          </span>
          <input
            className={`bracket-score${aFilled ? ' filled' : ''}`}
            type="number"
            min={0}
            disabled={!ready}
            value={aFilled ? pick!.a : ''}
            onChange={(e) => setScore(match.id, 'a', e.target.value)}
          />
        </div>
      </div>
      {!ready && <div className="ko-not-ready">Waiting for official teams</div>}
      {ready && isDraw && (
        <div className="et-row compact">
          <span className="muted">Advances</span>
          <button className={`et-btn${pick?.et === home ? ' sel' : ''}`} onClick={() => setEt(match.id, home!)}>
            {home}
          </button>
          <button className={`et-btn${pick?.et === away ? ' sel' : ''}`} onClick={() => setEt(match.id, away!)}>
            {away}
          </button>
        </div>
      )}
    </div>
  );
}
