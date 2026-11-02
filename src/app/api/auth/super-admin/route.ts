import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getConfiguredAdminSecret,
  safeCompareSecret,
  signSuperAdminSession,
  SUPER_ADMIN_COOKIE,
} from "@/lib/auth/adminAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const providedToken = String(body.token || "").trim();

    if (!providedToken) {
      return NextResponse.json(
        { ok: false, message: "Ingresá el Token Maestro (ADMIN_SECRET)." },
        { status: 400 }
      );
    }

    const expectedSecret = getConfiguredAdminSecret();
    if (!safeCompareSecret(providedToken, expectedSecret)) {
      return NextResponse.json(
        { ok: false, message: "Token Maestro inválido. Acceso denegado." },
        { status: 401 }
      );
    }

    const signed = signSuperAdminSession();
    const cookieStore = await cookies();
    cookieStore.set(SUPER_ADMIN_COOKIE, signed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Error autenticando Super-Admin." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPER_ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}

