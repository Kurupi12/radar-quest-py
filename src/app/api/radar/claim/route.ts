import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import { isCloudDbEnabled } from "@/lib/db/prisma";
import { findHunterById } from "@/lib/db/store";
import { processRadarClaim } from "@/lib/radar/engine";
import type { Hunter, RadarClaimRequest } from "@/types/radar";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RadarClaimRequest;
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;

    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(body.sessionToken);

    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          code: "HUNTER_NOT_REGISTERED",
          message:
            "Sesión de cazador inválida o expirada. Vuelve a confirmar tu identidad antes de reclamar.",
        },
        { status: 401 }
      );
    }

    const effectiveHunterId = verified.hunterId;
    let verifiedHunter: Hunter | null = await findHunterById(effectiveHunterId);

    if (!verifiedHunter && !isCloudDbEnabled() && verified.whatsapp) {
      verifiedHunter = {
        id: verified.hunterId,
        alias: verified.alias,
        whatsapp: verified.whatsapp,
        isAdult18: Boolean(verified.isAdult18),
        createdAt: new Date().toISOString(),
      };
    }

    const result = await processRadarClaim(
      {
        ...body,
        lat: Number(body.lat),
        lng: Number(body.lng),
        accuracy: Number(body.accuracy || 10),
        hunterId: effectiveHunterId,
        alias: verified.alias,
      },
      verifiedHunter
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error validando reclamo de QR físico.",
      },
      { status: 500 }
    );
  }
}
