import { cookies } from 'next/headers';
import crypto from 'crypto';
import { config } from './config';
import type { PoolData } from './types';

// ── Deadline / lock ──
export function isLocked(pool: PoolData): boolean {
  if (pool.settings.status === 'locked') return true;
  const dl = pool.settings.picksDeadline;
  if (!dl) return false;
  return Date.now() > new Date(dl).getTime();
}

// ── Admin auth (httpOnly cookie holding the shared secret) ──
const COOKIE = 'wc_admin';
export function adminCookieValue(): string {
  return config.adminSecret;
}
export function isAdminRequest(): boolean {
  if (!config.adminSecret) return false;
  const c = cookies().get(COOKIE);
  return !!c && c.value === config.adminSecret;
}
export const ADMIN_COOKIE_NAME = COOKIE;

// ── Player passwords (scrypt, no external deps) ──
// Human-friendly password: 8 chars from an unambiguous alphabet.
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword(len = 8): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length];
  return out;
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  if (!salt || !hash) return false;
  const got = crypto.scryptSync(password, salt, 32);
  const want = Buffer.from(hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ── Player session (signed cookie holding the participant id) ──
const PLAYER_COOKIE = 'wc_player';

function sign(value: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

export function makePlayerToken(participantId: string): string {
  const b = Buffer.from(participantId).toString('base64url');
  return `${b}.${sign(b)}`;
}

export function readPlayerToken(token: string | undefined): string | null {
  if (!token || !config.sessionSecret) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const b = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = sign(b);
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    return Buffer.from(b, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function getPlayerId(): string | null {
  const c = cookies().get(PLAYER_COOKIE);
  return readPlayerToken(c?.value);
}

export const PLAYER_COOKIE_NAME = PLAYER_COOKIE;
