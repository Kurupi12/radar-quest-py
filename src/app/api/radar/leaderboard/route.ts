import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import {
  findBrandBySlug,
  getBrandLeaderboardAndHistory,
} from "@/lib/db/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandSlug = searchParams.get("brandSlug")?.trim() || "";
    const cityFilter = searchParams.get("city")?.trim() || null;
    const queryToken = searchParams.get("sessionToken")?.trim() || undefined;
    const headerToken = request.headers.get("x-hunter-session") || undefined;

    if (!brandSlug) {
      return NextResponse.json(
        { ok: false, message: "Falta el parámetro brandSlug." },
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

    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;
    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(headerToken) ||
      verifyHunterSession(queryToken);

    const data = await getBrandLeaderboardAndHistory(
      brand.id,
      verified?.hunterId || null,
      cityFilter
    );

    return NextResponse.json({
      ok: true,
      brandSlug: brand.slug,
      ...data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error cargando el ranking de cazadores.",
      },
      { status: 500 }
    );
  }
}
