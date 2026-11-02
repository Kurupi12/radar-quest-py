import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BRAND_SESSION_COOKIE,
  safeCompareSecret,
  signBrandSession,
} from "@/lib/auth/adminAuth";
import { findBrandBySlug } from "@/lib/db/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brandSlug = String(body.brandSlug || "").trim().toLowerCase();
    const pin = String(body.pin || "").trim();

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, message: "El PIN del comercio debe tener exactamente 6 dígitos numéricos." },
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

    if (!safeCompareSecret(pin, brand.adminPin)) {
      return NextResponse.json(
        { ok: false, message: "PIN incorrecto. Verificá tu código de 6 dígitos con CeroUno Studio." },
        { status: 401 }
      );
    }

    const signedCookie = signBrandSession(brand.id, brand.slug);
    const cookieStore = await cookies();
    cookieStore.set(BRAND_SESSION_COOKIE, signedCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      ok: true,
      brandSlug: brand.slug,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Error verificando el PIN del comercio." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(BRAND_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}

