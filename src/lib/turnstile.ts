import crypto from "node:crypto";

const turnstileSiteVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const participantSessionDurationMs = 1000 * 60 * 60 * 24 * 90;

export const turnstileActions = {
  createEvent: "create_event",
  joinEvent: "join_event",
} as const;

export const participantCookieConfig = {
  name: "reuniator_participant_session",
  maxAge: participantSessionDurationMs / 1000,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export function isTurnstileEnabled(): boolean {
  return process.env.TURNSTILE_ENABLED?.toLowerCase() === "true";
}

function getTurnstileHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES || "")
      .split(",")
      .map(hostname => hostname.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing required environment variable: ADMIN_SESSION_SECRET");
  }

  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function getPublicTurnstileConfig() {
  const enabled = isTurnstileEnabled();
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || "";
  const secret = process.env.TURNSTILE_SECRET?.trim() || "";
  const hostnames = getTurnstileHostnames();

  return {
    enabled,
    configured: enabled && Boolean(siteKey) && Boolean(secret) && hostnames.size > 0,
    siteKey: enabled && siteKey ? siteKey : "",
    actions: turnstileActions,
  };
}

export async function verifyTurnstileToken(
  request: Request,
  token: unknown,
  expectedAction: string
): Promise<TurnstileVerificationResult> {
  if (!isTurnstileEnabled()) {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET?.trim();
  const hostnames = getTurnstileHostnames();
  if (!secret || hostnames.size === 0) {
    return {
      ok: false,
      status: 503,
      error: "A verificação de segurança está indisponível. Tente novamente mais tarde.",
    };
  }

  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    return {
      ok: false,
      status: 400,
      error: "Conclua a verificação de segurança antes de continuar.",
    };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token.trim());

  const remoteIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (remoteIp) {
    form.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(turnstileSiteVerifyUrl, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Turnstile siteverify returned ${response.status}`);
    }

    const result = await response.json();
    const hostname = String(result.hostname || "").trim().toLowerCase();

    if (!result.success || result.action !== expectedAction || !hostnames.has(hostname)) {
      return {
        ok: false,
        status: 400,
        error: "A verificação de segurança é inválida ou expirou. Tente novamente.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Error verifying Turnstile token:", error);
    return {
      ok: false,
      status: 503,
      error: "A verificação de segurança está indisponível. Tente novamente mais tarde.",
    };
  }
}

export function createParticipantSessionToken(eventId: string, participantId: string): string {
  const exp = Date.now() + participantSessionDurationMs;
  const payload = `${eventId}:${participantId}:${exp}`;
  return `${payload}:${signPayload(payload)}`;
}

export function verifyParticipantSessionToken(
  token: string | undefined,
  eventId: string,
  participantId: string
): boolean {
  if (!isTurnstileEnabled()) {
    return true;
  }

  if (!token) {
    return false;
  }

  const [tokenEventId, tokenParticipantId, expRaw, signature] = token.split(":");
  if (!tokenEventId || !tokenParticipantId || !expRaw || !signature) {
    return false;
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return false;
  }

  if (tokenEventId !== eventId || tokenParticipantId !== participantId) {
    return false;
  }

  return verifySignature(`${tokenEventId}:${tokenParticipantId}:${expRaw}`, signature);
}
