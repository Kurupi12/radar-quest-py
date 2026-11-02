import crypto from "node:crypto";
import { cookies } from "next/headers";
import type {
  BrandSessionPayload,
  SuperAdminSessionPayload,
} from "@/types/radar";

export const BRAND_SESSION_COOKIE = "brand_session";
export const SUPER_ADMIN_COOKIE = "cerouno_admin_session";

const AUTH_HMAC_SECRET =
  process.env.RADAR_QUEST_HMAC_SECRET ||
  process.env.ADMIN_SECRET ||
  "cerouno_studio_radar_quest_py_hmac_secret_2026_v2";

/**
 * Master secret for CeroUno Studio Super-Admin (/admin).
 * Uses ADMIN_SECRET env variable in production; falls back to dev token locally if unset.
 */
export function getConfiguredAdminSecret(): string {
  return process.env.ADMIN_SECRET || "CEROUNO-MASTER-2026";
}

/**
 * Constant-time string comparison using SHA-256 digest normalization.
 */
export function safeCompareSecret(provided: string, expected: string): boolean {
  const hashA = crypto.createHash("sha256").update(provided, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signPayload<T extends object>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", AUTH_HMAC_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyPayload<T extends { exp?: number }>(
  token: string | undefined | null
): T | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", AUTH_HMAC_SECRET)
    .update(encoded)
    .digest("base64url");

  const bufA = Buffer.from(providedSig, "utf8");
  const bufB = Buffer.from(expectedSig, "utf8");
  if (bufA.length !== bufB.length) return null;
  if (!crypto.timingSafeEqual(bufA, bufB)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as T;
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signBrandSession(brandId: string, brandSlug: string): string {
  const now = Date.now();
  const payload: BrandSessionPayload = {
    role: "BRAND_ADMIN",
    brandId,
    brandSlug: brandSlug.toLowerCase(),
    iat: now,
    exp: now + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  return signPayload(payload);
}

export function verifyBrandSessionToken(
  token: string | undefined | null
): BrandSessionPayload | null {
  const parsed = verifyPayload<BrandSessionPayload>(token);
  if (!parsed || parsed.role !== "BRAND_ADMIN" || !parsed.brandSlug) {
    return null;
  }
  return parsed;
}

export function signSuperAdminSession(): string {
  const now = Date.now();
  const payload: SuperAdminSessionPayload = {
    role: "SUPER_ADMIN",
    studio: "CeroUno Studio",
    iat: now,
    exp: now + 1000 * 60 * 60 * 12, // 12 hours
  };
  return signPayload(payload);
}

export function verifySuperAdminToken(
  token: string | undefined | null
): SuperAdminSessionPayload | null {
  const parsed = verifyPayload<SuperAdminSessionPayload>(token);
  if (!parsed || parsed.role !== "SUPER_ADMIN") return null;
  return parsed;
}

/**
 * Checks if current request has valid Brand Admin session for targetSlug
 * OR valid Super-Admin CeroUno Studio master session.
 */
export async function hasBrandAdminAccess(targetSlug: string): Promise<{
  authorized: boolean;
  via: "brand_session" | "super_admin" | null;
}> {
  const cookieStore = await cookies();
  const brandToken = cookieStore.get(BRAND_SESSION_COOKIE)?.value;
  const brandSession = verifyBrandSessionToken(brandToken);

  if (
    brandSession &&
    brandSession.brandSlug.toLowerCase() === targetSlug.trim().toLowerCase()
  ) {
    return { authorized: true, via: "brand_session" };
  }

  const superToken = cookieStore.get(SUPER_ADMIN_COOKIE)?.value;
  const superSession = verifySuperAdminToken(superToken);
  if (superSession) {
    return { authorized: true, via: "super_admin" };
  }

  return { authorized: false, via: null };
}

/**
 * Checks if current request has valid Super-Admin CeroUno Studio session
 * (either via signed cookie OR Authorization: Bearer <ADMIN_SECRET> header).
 */
export async function hasSuperAdminAccess(
  request?: Request
): Promise<boolean> {
  if (request) {
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const provided = authHeader.slice(7).trim();
      if (provided && safeCompareSecret(provided, getConfiguredAdminSecret())) {
        return true;
      }
    }
  }

  const cookieStore = await cookies();
  const superToken = cookieStore.get(SUPER_ADMIN_COOKIE)?.value;
  return Boolean(verifySuperAdminToken(superToken));
}

