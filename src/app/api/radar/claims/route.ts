import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import { findBrandBySlug, listClaimsForHunterByBrand } from "@/lib/db/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandSlug = searchParams.get("brandSlug")?.trim() || "";
    const queryToken = searchParams.get("sessionToken")?.trim() || undefined;
    const headerToken = request.headers.get("x-hunter-session") || undefined;

    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;

    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(headerToken) ||
      verifyHunterSession(queryToken);

    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          code: "SESSION_INVALID",
          claims: [],
          message: "Sesión de cazador no autenticada.",
        },
        { status: 401 }
      );
    }

    const effectiveBrandSlug = brandSlug || verified.brandSlug;
    const brand = await findBrandBySlug(effectiveBrandSlug);
    if (!brand) {
      return NextResponse.json(
        { ok: false, claims: [], message: "Marca no encontrada." },
        { status: 404 }
      );
    }

    const claims = await listClaimsForHunterByBrand(brand.id, verified.hunterId);

    return NextResponse.json({
      ok: true,
      brandSlug: brand.slug,
      hunterId: verified.hunterId,
      alias: verified.alias,
      claims,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        claims: [],
        message:
          err instanceof Error
            ? err.message
            : "Error recuperando cupones del cazador.",
      },
      { status: 500 }
    );
  }
}
