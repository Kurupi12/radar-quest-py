import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HUNTER_SESSION_COOKIE, verifyHunterSession } from "@/lib/auth/hmac";
import { processRadarPing } from "@/lib/radar/engine";
import type { RadarPingRequest } from "@/types/radar";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RadarPingRequest;
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(HUNTER_SESSION_COOKIE)?.value;

    const verified =
      verifyHunterSession(cookieToken) ||
      verifyHunterSession(body.sessionToken);

    const effectiveHunterId = verified?.hunterId || body.hunterId;
    const effectiveAlias = verified?.alias || body.alias || "@cazador";

    if (!effectiveHunterId || !body.missionId) {
      return NextResponse.json(
        { ok: false, message: "Faltan datos de cazador o misión activa." },
        { status: 400 }
      );
    }

    const prevState =
      body.prevTacticalState &&
      typeof body.prevTacticalState === "object" &&
      typeof body.prevTacticalState.message === "string" &&
      typeof body.prevTacticalState.emittedAtMs === "number"
        ? body.prevTacticalState
        : null;

    const result = await processRadarPing({
      ...body,
      lat: Number(body.lat),
      lng: Number(body.lng),
      accuracy: Number(body.accuracy || 12),
      hunterId: effectiveHunterId,
      alias: effectiveAlias,
      prevTacticalState: prevState,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error procesando ping de radar.",
      },
      { status: 400 }
    );
  }
}
