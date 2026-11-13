import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  HUNTER_SESSION_COOKIE,
  normalizeWhatsapp,
  signHunterSession,
  verifyHunterSession,
} from "@/lib/auth/hmac";
import {
  findBrandBySlug,
  findHunterById,
  upsertHunterAndLead,
} from "@/lib/db/store";
import {
  sanitizePublicAlias,
  validateRegistrationAlias,
} from "@/lib/radar/aliasPrivacy";

export async function GET() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;
  const session = verifyHunterSession(rawToken);

  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false });
  }

  const hunter = await findHunterById(session.hunterId);
  const safeHunter = hunter
    ? { ...hunter, alias: sanitizePublicAlias(hunter.alias) }
    : null;

  return NextResponse.json({
    ok: true,
    authenticated: true,
    session,
    hunter: safeHunter,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawAlias = String(body.alias || "").trim();
    const rawWhatsapp = String(body.whatsapp || "").trim();
    const isAdult18 = Boolean(body.isAdult18);
    const brandSlug = String(body.brandSlug || "el-vape-club").trim();
    const sourceMissionId = body.sourceMissionId
      ? String(body.sourceMissionId)
      : null;

    const aliasCheck = validateRegistrationAlias(rawAlias);
    if (!aliasCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: aliasCheck.message,
        },
        { status: 400 }
      );
    }

    const whatsapp = normalizeWhatsapp(rawWhatsapp);
    if (!whatsapp) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Ingresá un número de WhatsApp válido (ej: 0981 555 420 o +595981555420).",
        },
        { status: 400 }
      );
    }

    const brand = await findBrandBySlug(brandSlug);
    if (!brand) {
      return NextResponse.json(
        { ok: false, message: "Marca no encontrada." },
        { status: 404 }
      );
    }

    if (brand.requireAdult18 && !isAdult18) {
      return NextResponse.json(
        {
          ok: false,
          message: `${brand.name} requiere confirmar mayoría de edad (+18) para participar.`,
        },
        { status: 403 }
      );
    }

    const cleanAlias = aliasCheck.alias;
    const hunter = await upsertHunterAndLead({
      alias: cleanAlias,
      whatsapp,
      isAdult18,
      brand,
      sourceMissionId,
    });

    const sessionPayload = {
      hunterId: hunter.id,
      alias: hunter.alias,
      whatsapp: hunter.whatsapp,
      isAdult18: hunter.isAdult18,
      brandSlug: brand.slug,
      iat: Date.now(),
    };

    const signedToken = signHunterSession(sessionPayload);
    const cookieStore = await cookies();
    cookieStore.set(HUNTER_SESSION_COOKIE, signedToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      ok: true,
      hunter,
      sessionToken: signedToken,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error en registro Arcade.",
      },
      { status: 500 }
    );
  }
}
