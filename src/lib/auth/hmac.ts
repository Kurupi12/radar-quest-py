import crypto from "node:crypto";
import type { HunterSessionPayload } from "@/types/radar";

export const HUNTER_SESSION_COOKIE = "rq_hunter_session";

const HMAC_SECRET =
  process.env.RADAR_QUEST_HMAC_SECRET ||
  "cerouno_studio_radar_quest_py_hmac_secret_2026_v1";

/**
 * Signs a hunter session payload using HMAC-SHA256 (Base64URL encoded).
 */
export function signHunterSession(payload: HunterSessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed hunter session token using constant-time comparison.
 */
export function verifyHunterSession(
  token: string | undefined | null
): HunterSessionPayload | null {
  if (!token || !token.includes(".")) return null;

  const [encodedPayload, providedSig] = token.split(".");
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  const bufProvided = Buffer.from(providedSig, "utf8");
  const bufExpected = Buffer.from(expectedSig, "utf8");

  if (bufProvided.length !== bufExpected.length) return null;
  if (!crypto.timingSafeEqual(bufProvided, bufExpected)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as HunterSessionPayload;
    if (!parsed.hunterId || !parsed.whatsapp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Normalizes a Paraguayan or international WhatsApp phone number to E.164-like format.
 */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  const clean = digits.replace(/^\+/, "");

  // Paraguayan local mobile starting with 09... -> +5959...
  if (/^09\d{8}$/.test(clean)) {
    return `+595${clean.slice(1)}`;
  }
  // Paraguayan local mobile starting with 9... (9 digits) -> +5959...
  if (/^9\d{8}$/.test(clean)) {
    return `+595${clean}`;
  }
  // Already starts with 595...
  if (/^595\d{8,9}$/.test(clean)) {
    return `+${clean}`;
  }
  return clean.length >= 8 ? `+${clean}` : "";
}

