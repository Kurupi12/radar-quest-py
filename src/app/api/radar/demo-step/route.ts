import { NextResponse } from "next/server";
import { findMissionById } from "@/lib/db/store";

export async function POST(request: Request) {
  if (process.env.DISABLE_RADAR_DEMO === "true") {
    return NextResponse.json(
      { ok: false, message: "Simulador deshabilitado." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const missionId = String(body.missionId || "");
    const preset = String(body.preset || "TIBIO");

    const mission = await findMissionById(missionId);
    if (!mission) {
      return NextResponse.json(
        { ok: false, message: "Misión no encontrada." },
        { status: 404 }
      );
    }

    const meterLat = 1 / 111_320;
    let offsetMeters = 280;
    let accuracy = 8;

    switch (preset) {
      case "FUERA":
        offsetMeters = mission.zoneRadiusMeters + 600;
        accuracy = 18;
        break;
      case "CONGELADO":
        offsetMeters = 920;
        accuracy = 14;
        break;
      case "TIBIO":
        offsetMeters = 310;
        accuracy = 11;
        break;
      case "CALIENTE":
        offsetMeters = 75;
        accuracy = 9;
        break;
      case "QUEMANDO":
        offsetMeters = 14;
        accuracy = 6;
        break;
      case "VEHICLE":
        offsetMeters = 22;
        accuracy = 12;
        break;
      case "TELEPORT":
        offsetMeters = 780;
        accuracy = 15;
        break;
      default:
        offsetMeters = 150;
    }

    const jitterAngle = (Date.now() % 360) * (Math.PI / 180);
    const lat = Number(
      (
        mission.secretLat +
        offsetMeters * meterLat * Math.cos(jitterAngle * 0.15)
      ).toFixed(6)
    );
    const lng = Number(
      (
        mission.secretLng +
        offsetMeters * meterLat * Math.sin(jitterAngle * 0.15)
      ).toFixed(6)
    );

    return NextResponse.json({
      ok: true,
      lat,
      lng,
      accuracy,
      demoQrCode: mission.nodeCode || mission.qrToken,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Error en demo step",
      },
      { status: 500 }
    );
  }
}
