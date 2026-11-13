import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import { processRadarTriangulation } from "@/lib/radar/engine";
import type { TriangulateRequest } from "@/types/radar";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TriangulateRequest;
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;

    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(body.sessionToken);

    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          code: "SESSION_INVALID",
          message:
            "Sesión de cazador inválida o expirada. Vuelve a registrar tu alias.",
        },
        { status: 401 }
      );
    }

    if (!body.missionId) {
      return NextResponse.json(
        { ok: false, message: "Faltan datos de misión activa." },
        { status: 400 }
      );
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { ok: false, message: "Coordenadas GPS inválidas." },
        { status: 400 }
      );
    }

    const result = await processRadarTriangulation({
      missionId: body.missionId,
      hunterId: verified.hunterId,
      lat,
      lng,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error ejecutando pulso de triangulación.",
      },
      { status: 400 }
    );
  }
}
