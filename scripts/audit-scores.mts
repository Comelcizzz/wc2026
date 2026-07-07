/**
 * Audit pool scoring — downloads /api/pool or reads a JSON file and prints a full breakdown.
 * Usage:
 *   npx tsx scripts/audit-scores.mts https://wc2026-rose-zeta.vercel.app/api/pool
 *   npx tsx scripts/audit-scores.mts /tmp/pool.json
 */
import { readFileSync } from 'node:fs';
import { calcScores, gradeGroupMatch, gradeKoMatch, koWinnerFromResult } from '../lib/scoring.ts';
import { resolveRealKoTeams, resultsFromMatches } from '../lib/bracket.ts';
import { KO_MATCH_IDS, ROUND_LABELS } from '../lib/tournament.ts';
import type { PoolData, Participant } from '../lib/types.ts';

async function loadPool(source: string) {
  if (source.startsWith('http')) {
    const res = await fetch(source, { cache: 'no-store' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Pool fetch failed');
    return json;
  }
  const raw = JSON.parse(readFileSync(source, 'utf8'));
  if (raw.ok && raw.participants) return raw;
  if (raw.data?.participants) return { ok: true, ...raw.data, standings: [] };
  throw new Error('Unrecognized pool JSON shape');
}

function poolDataFromResponse(res: any): PoolData {
  return {
    settings: res.settings,
    participants: res.participants,
    matches: res.matches,
    koBracket: res.koBracket,
    chat: res.chat,
    matchComments: res.matchComments,
  };
}

function findArgentinaEgypt(pool: PoolData) {
  const hits: { id: string; round: string; home?: string; away?: string; result?: any }[] = [];
  for (const m of pool.matches) {
    const teams = [m.home, m.away, m.result?.home, m.result?.away].filter(Boolean);
    if (teams.includes('Argentina') && teams.includes('Egypt')) {
      hits.push({ id: m.id, round: m.round, home: m.home || m.result?.home, away: m.away || m.result?.away, result: m.result });
    }
  }
  for (const fx of pool.koBracket.r32 || []) {
    if ((fx.home === 'Argentina' && fx.away === 'Egypt') || (fx.home === 'Egypt' && fx.away === 'Argentina')) {
      hits.push({ id: fx.id, round: 'r32-fixture', home: fx.home, away: fx.away, result: pool.matches.find((m) => m.id === fx.id)?.result });
    }
  }
  return hits;
}

function auditParticipant(p: Participant, pool: PoolData, results: Record<string, any>) {
  const group: { id: string; pick?: string; result?: string; grade: string; pts: number }[] = [];
  const ko: { id: string; round: string; pick?: string; result?: string; grade: string; pts: number; issue?: string }[] = [];

  for (const m of pool.matches) {
    if (m.round === 'group') {
      const pick = p.picks?.[m.id];
      const g = gradeGroupMatch(pick, m.result);
      if (m.result?.homeGoals != null || pick) {
        group.push({
          id: m.id,
          pick: pick ? `${pick.h}:${pick.a}` : '—',
          result: m.result?.homeGoals != null ? `${m.home} ${m.result.homeGoals}:${m.result.awayGoals} ${m.away}` : 'pending',
          grade: g.status,
          pts: g.points,
        });
      }
      continue;
    }
    const pick = p.koPicks?.[m.id];
    const res = m.result;
    const g = gradeKoMatch(m.round, pick, res);
    const official = resolveRealKoTeams(m.id, results, pool.koBracket);
    let issue: string | undefined;
    if (res?.homeGoals != null) {
      if (!official?.home || !official?.away) issue = 'no official teams';
      else if (!koWinnerFromResult(res)) issue = 'result missing winner';
      else if (!res.home || !res.away) issue = 'result missing home/away names';
    }
    if (pick || res?.homeGoals != null) {
      ko.push({
        id: m.id,
        round: m.round,
        pick: pick ? `${pick.h}:${pick.a}${pick.et ? ` (${pick.et})` : ''}` : '—',
        result: res?.homeGoals != null
          ? `${res.home} ${res.homeGoals}:${res.awayGoals} ${res.away} → ${koWinnerFromResult(res) || '?'}`
          : 'pending',
        grade: g.status,
        pts: g.points,
        issue,
      });
    }
  }

  const scored = calcScores(pool).find((s) => s.id === p.id)!;
  return { group, ko, scored };
}

const source = process.argv[2] || 'https://wc2026-rose-zeta.vercel.app/api/pool';
const res = await loadPool(source);
const pool = poolDataFromResponse(res);
const results = resultsFromMatches(pool.matches);
const standings = calcScores(pool);

console.log('\n=== POOL AUDIT ===');
console.log(`Pool: ${pool.settings.name}`);
console.log(`Participants: ${pool.participants.length}`);
console.log(`Group results entered: ${pool.matches.filter((m) => m.round === 'group' && m.result?.homeGoals != null).length}/72`);
console.log(`KO results entered: ${pool.matches.filter((m) => m.round !== 'group' && m.result?.homeGoals != null).length}`);

const argEgy = findArgentinaEgypt(pool);
console.log('\n=== Argentina vs Egypt matches ===');
if (!argEgy.length) console.log('(none found in schedule or fixtures)');
else argEgy.forEach((h) => console.log(JSON.stringify(h, null, 2)));

console.log('\n=== STANDINGS (recalculated) ===');
standings.forEach((s, i) => {
  console.log(
    `${String(i + 1).padStart(2)}. ${s.name.padEnd(18)} group=${String(s.groupPoints).padStart(3)} ko=${String(s.koPoints).padStart(3)} total=${s.totalPoints} exact=${s.exactCount}`,
  );
});

// Compare with API standings if present
if (res.standings?.length) {
  let mismatches = 0;
  for (const s of standings) {
    const api = res.standings.find((x: any) => x.id === s.id);
    if (api && api.totalPoints !== s.totalPoints) {
      mismatches++;
      console.log(`MISMATCH ${s.name}: API total=${api.totalPoints} recalc=${s.totalPoints}`);
    }
  }
  if (!mismatches) console.log('\n✓ Recalculated standings match live API response');
  else console.log(`\n✗ ${mismatches} standings mismatches vs API`);
}

// Ivan / Argentina focus
const ivan = pool.participants.find((p) => p.name.toLowerCase().includes('ivan'));
if (ivan) {
  console.log('\n=== IVAN DETAIL ===');
  const a = auditParticipant(ivan, pool, results);
  console.log(`Totals: group=${a.scored.groupPoints} ko=${a.scored.koPoints} total=${a.scored.totalPoints}`);
  const koWithPts = a.ko.filter((k) => k.pts > 0 || (k.result !== 'pending' && k.pick !== '—'));
  console.log('\nKO picks with results:');
  for (const k of koWithPts.filter((x) => x.result !== 'pending').slice(0, 20)) {
    console.log(`  ${k.id} [${k.round}] pick ${k.pick} | ${k.result} | ${k.grade} +${k.pts}${k.issue ? ` ⚠ ${k.issue}` : ''}`);
  }
  const pendingKo = a.ko.filter((k) => k.result !== 'pending' && k.pts === 0 && k.pick !== '—' && k.grade === 'miss');
  if (pendingKo.length) {
    console.log('\nKO misses (had pick, result in):');
    pendingKo.forEach((k) => console.log(`  ${k.id} pick ${k.pick} | ${k.result}`));
  }
}

// Results with scores but no gradable winner
console.log('\n=== KO RESULTS WITH SCORING ISSUES ===');
let issues = 0;
for (const m of pool.matches) {
  if (m.round === 'group') continue;
  const res = m.result;
  if (!res || res.homeGoals == null) continue;
  const official = resolveRealKoTeams(m.id, results, pool.koBracket);
  const winner = koWinnerFromResult(res);
  const problems: string[] = [];
  if (!official?.home || !official?.away) problems.push('no official fixture');
  if (!res.home || !res.away) problems.push('result missing team names');
  if (!winner) problems.push('no winner (draw without ET?)');
  if (problems.length) {
    issues++;
    const meta = KO_MATCH_IDS.find((x) => x.id === m.id);
    console.log(`  ${m.id} M${meta?.m ?? '?'}: ${res.home || '?'} ${res.homeGoals}:${res.awayGoals} ${res.away || '?'} — ${problems.join(', ')}`);
  }
}
if (!issues) console.log('  (none — all entered KO results are gradable)');

// Group J Argentina matches
console.log('\n=== GROUP J (Argentina) results ===');
for (const m of pool.matches.filter((m) => m.group === 'J' && m.result?.homeGoals != null)) {
  console.log(`  ${m.id}: ${m.home} ${m.result!.homeGoals}:${m.result!.awayGoals} ${m.away}`);
}