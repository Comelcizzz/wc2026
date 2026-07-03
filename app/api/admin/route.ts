import { NextRequest, NextResponse } from 'next/server';
import { readPool, writePool } from '@/lib/poolStore';
import { isAdminRequest, generatePassword, hashPassword } from '@/lib/auth';
import { KO_MATCH_IDS, TEAMS } from '@/lib/tournament';
import type { KoFixture, MatchResult, Participant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ authed: isAdminRequest() });
}

const KO_BY_ID = new Map(KO_MATCH_IDS.map((m) => [m.id, m]));
const TEAM_SET = new Set(TEAMS);

export async function POST(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  try {
    const pool = await readPool();
    const action = String(body.action || '');
    let extra: Record<string, any> = {};

    switch (action) {
      case 'generatePasswords': {
        // Generate for everyone missing a password (or all, if regenerateAll).
        const all = !!body.regenerateAll;
        const creds: { name: string; password: string }[] = [];
        for (const p of pool.participants) {
          if (!all && p.passHash) continue;
          const pw = generatePassword();
          const { salt, hash } = hashPassword(pw);
          p.passSalt = salt;
          p.passHash = hash;
          creds.push({ name: p.name, password: pw });
        }
        extra.credentials = creds;
        break;
      }

      case 'regeneratePassword': {
        const p = pool.participants.find((x) => x.id === String(body.participantId));
        if (!p) return NextResponse.json({ ok: false, error: 'Player not found.' }, { status: 400 });
        const pw = generatePassword();
        const { salt, hash } = hashPassword(pw);
        p.passSalt = salt;
        p.passHash = hash;
        extra.credentials = [{ name: p.name, password: pw }];
        break;
      }

      case 'addParticipant': {
        const name = String(body.name || '').trim();
        if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
        if (pool.participants.some((x) => x.name.trim().toLowerCase() === name.toLowerCase())) {
          return NextResponse.json({ ok: false, error: 'That name already exists.' }, { status: 400 });
        }
        const pw = generatePassword();
        const { salt, hash } = hashPassword(pw);
        const np: Participant = {
          id: Date.now().toString(),
          name,
          email: '',
          paid: false,
          picks: {},
          passSalt: salt,
          passHash: hash,
          submittedAt: new Date().toISOString(),
        };
        pool.participants.push(np);
        extra.credentials = [{ name, password: pw }];
        break;
      }

      case 'setR32': {
        // fixtures: [{id, home, away}] — validate ids + teams
        const fixtures: KoFixture[] = [];
        for (const f of body.fixtures || []) {
          const id = String(f.id || '');
          if (!id.startsWith('R32-')) continue;
          const home = String(f.home || '');
          const away = String(f.away || '');
          if (home && !TEAM_SET.has(home)) {
            return NextResponse.json({ ok: false, error: `Unknown team: ${home}` }, { status: 400 });
          }
          if (away && !TEAM_SET.has(away)) {
            return NextResponse.json({ ok: false, error: `Unknown team: ${away}` }, { status: 400 });
          }
          fixtures.push({ id, home, away });
        }
        pool.koBracket.r32 = fixtures;
        break;
      }

      case 'setRoundFixtures': {
        const round = String(body.round || '') as keyof typeof pool.koBracket;
        const validRounds = ['r16', 'qf', 'sf', '3rd', 'final'] as const;
        if (!validRounds.includes(round as any)) {
          return NextResponse.json({ ok: false, error: 'Invalid round.' }, { status: 400 });
        }
        const fixtures: KoFixture[] = [];
        for (const f of body.fixtures || []) {
          const id = String(f.id || '');
          const meta = KO_BY_ID.get(id);
          if (!meta || meta.round !== round) continue;
          const home = String(f.home || '');
          const away = String(f.away || '');
          if (home && !TEAM_SET.has(home)) {
            return NextResponse.json({ ok: false, error: `Unknown team: ${home}` }, { status: 400 });
          }
          if (away && !TEAM_SET.has(away)) {
            return NextResponse.json({ ok: false, error: `Unknown team: ${away}` }, { status: 400 });
          }
          fixtures.push({ id, home, away });
        }
        (pool.koBracket as any)[round] = fixtures;
        break;
      }

      case 'lockR32': {
        if (pool.koBracket.r32.length !== 16) {
          return NextResponse.json(
            { ok: false, error: 'Enter all 16 Round of 32 fixtures before locking.' },
            { status: 400 },
          );
        }
        const incomplete = pool.koBracket.r32.some((f) => !f.home || !f.away);
        if (incomplete) {
          return NextResponse.json({ ok: false, error: 'Some fixtures are missing a team.' }, { status: 400 });
        }
        pool.koBracket.locked = true;
        break;
      }

      case 'unlockR32':
        pool.koBracket.locked = false;
        break;

      case 'setResult': {
        const id = String(body.matchId || '');
        if (!KO_BY_ID.has(id)) {
          return NextResponse.json({ ok: false, error: 'Unknown match.' }, { status: 400 });
        }
        const hg = Number(body.homeGoals);
        const ag = Number(body.awayGoals);
        if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0) {
          return NextResponse.json({ ok: false, error: 'Invalid score.' }, { status: 400 });
        }
        const home = String(body.home || '');
        const away = String(body.away || '');
        const winner = String(body.winner || '');
        if (!home || !away || !winner) {
          return NextResponse.json({ ok: false, error: 'Home, away and winner are required.' }, { status: 400 });
        }
        const result: MatchResult = { homeGoals: hg, awayGoals: ag, home, away, winner };
        const m = pool.matches.find((x) => x.id === id);
        if (m) m.result = result;
        break;
      }

      case 'clearResult': {
        const id = String(body.matchId || '');
        const m = pool.matches.find((x) => x.id === id);
        if (m) m.result = undefined;
        break;
      }

      case 'setGroupResult': {
        // For completeness: lets the admin still correct group results.
        const id = String(body.matchId || '');
        const m = pool.matches.find((x) => x.id === id && x.round === 'group');
        if (!m) return NextResponse.json({ ok: false, error: 'Unknown group match.' }, { status: 400 });
        const hg = Number(body.homeGoals);
        const ag = Number(body.awayGoals);
        if (!Number.isInteger(hg) || !Number.isInteger(ag)) {
          return NextResponse.json({ ok: false, error: 'Invalid score.' }, { status: 400 });
        }
        m.result = { homeGoals: hg, awayGoals: ag };
        break;
      }

      case 'clearGroupResult': {
        const id = String(body.matchId || '');
        const m = pool.matches.find((x) => x.id === id && x.round === 'group');
        if (m) m.result = undefined;
        break;
      }

      case 'setChampion':
        pool.settings.champion = String(body.champion || '') || undefined;
        break;

      case 'setTotalGoals':
        pool.settings.totalGoals =
          body.totalGoals == null || body.totalGoals === '' ? null : Number(body.totalGoals);
        break;

      case 'extendDeadline': {
        if (body.deadline) {
          const d = new Date(String(body.deadline));
          if (isNaN(d.getTime())) {
            return NextResponse.json({ ok: false, error: 'Invalid date.' }, { status: 400 });
          }
          pool.settings.picksDeadline = d.toISOString();
        } else if (body.addHours != null) {
          const cur = new Date(pool.settings.picksDeadline || Date.now());
          cur.setHours(cur.getHours() + Number(body.addHours));
          pool.settings.picksDeadline = cur.toISOString();
        }
        break;
      }

      case 'setStatus':
        pool.settings.status = body.status === 'locked' ? 'locked' : 'open';
        break;

      case 'setKoPickRound': {
        const round = String(body.round || '');
        const valid = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];
        if (!valid.includes(round)) {
          return NextResponse.json({ ok: false, error: 'Invalid round.' }, { status: 400 });
        }
        pool.settings.koPickRound = round as typeof pool.settings.koPickRound;
        break;
      }

      case 'setPaid': {
        const p = pool.participants.find((x) => x.id === String(body.participantId));
        if (p) p.paid = !!body.paid;
        break;
      }

      default:
        return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
    }

    await writePool(pool);
    return NextResponse.json({ ok: true, ...extra });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
