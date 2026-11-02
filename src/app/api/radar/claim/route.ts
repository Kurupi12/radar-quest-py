import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import { findHunterById } from "@/lib/db/store";
import { processRadarClaim } from "@/lib/radar/engine";
import type { RadarClaimRequest } from "@/types/radar";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RadarClaimRequest;
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;

    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(body.sessionToken);

    const effectiveHunterId = verified?.hunterId || body.hunterId;
    const verifiedHunter = effectiveHunterId
      ? await findHunterById(effectiveHunterId)
      : null;

    const result = await processRadarClaim(
      {
        ...body,
        lat: Number(body.lat),
        lng: Number(body.lng),
        accuracy: Number(body.accuracy || 10),
        hunterId: effectiveHunterId,
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
