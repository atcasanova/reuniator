import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const adminSessionCookieName = "reuniator_admin_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function hashPasswordForStorage(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = hashPassword(password, salt);
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, knownHash] = storedHash.split(":");
  if (!salt || !knownHash) {
    return false;
  }

  const attemptHash = hashPassword(password, salt);
  const knownBuffer = Buffer.from(knownHash, "hex");
  const attemptBuffer = Buffer.from(attemptHash, "hex");

  if (knownBuffer.length !== attemptBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(knownBuffer, attemptBuffer);
}

function signSession(payload: string): string {
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createAdminSessionToken(username: string): string {
  const exp = Date.now() + sessionDurationMs;
  const payload = `${username}:${exp}`;
  const signature = signSession(payload);
  return `${payload}:${signature}`;
}

export function parseAndVerifyAdminSessionToken(token: string): { username: string } | null {
  const [username, expRaw, signature] = token.split(":");
  if (!username || !expRaw || !signature) {
    return null;
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return null;
  }

  const payload = `${username}:${expRaw}`;
  const expected = signSession(payload);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return { username };
}

export async function getAdminSetupStatus() {
  const adminUsername = getRequiredEnv("ADMIN_USERNAME");
  const credential = await prisma.adminCredential.findUnique({ where: { id: "singleton" } });

  return {
    adminUsername,
    requiresSetup: !credential,
  };
}

export const adminCookieConfig = {
  name: adminSessionCookieName,
  maxAge: sessionDurationMs / 1000,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function getAuthenticatedAdminUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const parsed = parseAndVerifyAdminSessionToken(token);
  if (!parsed) {
    return null;
  }

  const expectedUsername = getRequiredEnv("ADMIN_USERNAME");
  if (parsed.username !== expectedUsername) {
    return null;
  }

  return parsed.username;
}
