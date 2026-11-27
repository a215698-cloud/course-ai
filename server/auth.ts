import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  claimPasscodeHashIfEmpty,
  getClaimedPasscodeHash,
  getOrCreatePersistedSessionSecret,
} from './store.ts';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
let cachedSessionSecret: string | null = null;

function getSessionSecret(): string {
  const envSecret = process.env.KAIRO_SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  const envPasscode = getEnvPasscode();
  if (envPasscode) {
    if (!cachedSessionSecret) {
      cachedSessionSecret = crypto
        .scryptSync(envPasscode, 'kairo-session-hmac-v1', 32)
        .toString('hex');
    }
    return cachedSessionSecret;
  }
  if (!cachedSessionSecret) {
    cachedSessionSecret = getOrCreatePersistedSessionSecret();
  }
  return cachedSessionSecret;
}

export function getEnvPasscode(): string | null {
  const raw = process.env.KAIRO_ACCESS_PASSCODE?.trim();
  if (!raw || raw === 'MY_KAIRO_ACCESS_PASSCODE') return null;
  return raw;
}

export function isAuthClaimed(): boolean {
  return Boolean(getEnvPasscode() || getClaimedPasscodeHash());
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPasscodeHash(passcode: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = crypto.scryptSync(passcode, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyAccessPasscode(passcode: string): boolean {
  const envPasscode = getEnvPasscode();
  if (envPasscode !== null) {
    return constantTimeStringEqual(passcode, envPasscode);
  }
  const claimedHash = getClaimedPasscodeHash();
  if (!claimedHash) return false;
  return verifyPasscodeHash(passcode, claimedHash);
}

export function claimInitialPasscode(passcode: string): { ok: boolean; error?: string } {
  if (getEnvPasscode() !== null) {
    return { ok: false, error: 'Passcode is already managed by server environment configuration.' };
  }
  if (passcode.length < 6 || passcode.length > 128) {
    return { ok: false, error: 'Passcode must be between 6 and 128 characters.' };
  }
  const hashed = hashPasscode(passcode);
  const inserted = claimPasscodeHashIfEmpty(hashed);
  if (!inserted) {
    return { ok: false, error: 'Workspace passcode has already been claimed. Please sign in.' };
  }
  return { ok: true };
}

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function issueSessionToken(subject: string = 'workspace-owner'): string {
  const now = Date.now();
  const payload: TokenPayload = {
    sub: subject,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const bufA = Buffer.from(providedSig, 'utf-8');
  const bufB = Buffer.from(expectedSig, 'utf-8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthClaimed()) {
    res.status(401).json({
      error: 'Workspace passcode setup required before accessing private messages.',
      authRequired: true,
      claimed: false,
    });
    return;
  }

  const token = extractBearerToken(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Authentication required. Please sign in with your workspace passcode.',
      authRequired: true,
      claimed: true,
    });
    return;
  }

  next();
}
