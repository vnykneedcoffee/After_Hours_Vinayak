import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface SessionPrincipal { roomId: string; participantId: string; }

const secret = process.env.SESSION_SECRET || "local-development-secret-change-before-deployment";

function encode(value: string): string { return Buffer.from(value).toString("base64url"); }
function decode(value: string): string { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(value: string): string { return createHmac("sha256", secret).update(value).digest("base64url"); }

export function signSession(principal: SessionPrincipal): string {
  const payload = encode(JSON.stringify({ ...principal, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token: unknown): SessionPrincipal | null {
  if (typeof token !== "string") return null;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const parsed: unknown = JSON.parse(decode(payload));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as { roomId?: unknown; participantId?: unknown; exp?: unknown };
    if (typeof value.roomId !== "string" || typeof value.participantId !== "string" || typeof value.exp !== "number" || value.exp < Date.now()) return null;
    return { roomId: value.roomId, participantId: value.participantId };
  } catch { return null; }
}

export function newAccessKey(): string { return randomBytes(24).toString("base64url"); }
export function hashAccessKey(accessKey: string): string { return createHmac("sha256", secret).update(`access:${accessKey}`).digest("hex"); }
