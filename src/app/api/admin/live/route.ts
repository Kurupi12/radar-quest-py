import { NextResponse } from "next/server";
import { hasBrandAdminAccess } from "@/lib/auth/adminAuth";
import {
  findBrandBySlug,
  getBrandAdminBundle,
  getBrandHeatmapAndAnalytics,
  toPublicBrand,
} from "@/lib/db/store";
import { getRecentPushDispatchLogs } from "@/lib/push/webPush";
import { calculateHaversineMeters } from "@/lib/radar/geo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandSlug = searchParams.get("brandSlug") || "el-vape-club";
  const missionIdFilter = searchParams.get("missionId") || "";
  const includeDemo =
    process.env.NODE_ENV === "production"
      ? searchParams.get("demo") === "1"
      : searchParams.get("demo") !== "0";

  const access = await hasBrandAdminAccess(brandSlug);
  if (!access.authorized) {
    return NextResponse.json(
      { ok: false, message: "No autorizado. Ingresá el PIN de 6 dígitos del comercio." },
      { status: 401 }
    );
  }

  const brand = await findBrandBySlug(brandSlug);
  if (!brand) {
    return NextResponse.json(
      { ok: false, message: "Marca no encontrada." },
      { status: 404 }
    );
  }

  const [bundle, bi] = await Promise.all([
    getBrandAdminBundle(brand.id),
    getBrandHeatmapAndAnalytics(brand.id),
  ]);
  const brandMissions = bundle.missions;
  const selectedMission =
    brandMissions.find((m) => m.id === missionIdFilter) ||
    brandMissions.find((m) => m.status === "ACTIVE") ||
    brandMissions[0] ||
    null;

  const nowMs = Date.now();

  const huntersLive = bundle.telemetry
    .filter((t) => {
      if (selectedMission && t.missionId !== selectedMission.id) return false;
      const ageMs = nowMs - new Date(t.lastPingAt).getTime();
      const isDemoBot = t.id.startsWith("tel_demo_");
      return ageMs <= 300_000 || (includeDemo && isDemoBot);
    })
    .map((t) => {
      const mission = brandMissions.find((m) => m.id === t.missionId);
      const isDemoBot = t.id.startsWith("tel_demo_");
      const ageMs = nowMs - new Date(t.lastPingAt).getTime();

      if (isDemoBot && ageMs > 60_000 && mission) {
        const phase = nowMs / 9000 + (t.id.charCodeAt(t.id.length - 1) || 0);
        const lat = Number(
          (t.lastLat + Math.sin(phase) * 0.00022).toFixed(6)
        );
        const lng = Number(
          (t.lastLng + Math.cos(phase) * 0.00022).toFixed(6)
        );
        const dist = Number(
          calculateHaversineMeters(
            lat,
            lng,
            mission.secretLat,
            mission.secretLng
          ).toFixed(1)
        );
        return {
          ...t,
          lastLat: lat,
          lastLng: lng,
          lastDistanceMeters: dist,
          isDemoBot: true,
          missionTitle: mission.title,
          missionCity: mission.city,
        };
      }

      return {
        ...t,
        isDemoBot,
        missionTitle: mission?.title || "",
        missionCity: mission?.city || "",
      };
    })
    .sort((a, b) => a.lastDistanceMeters - b.lastDistanceMeters);

  return NextResponse.json({
    ok: true,
    polledAt: new Date(nowMs).toISOString(),
    brand: toPublicBrand(brand),
    selectedMission,
    missions: brandMissions,
    stats: {
      connectedHunters: huntersLive.length,
      huntersInCaptureZone: huntersLive.filter(
        (h) =>
          h.lastDistanceMeters <= 65 && h.thermalState !== "TELEPORT_ANOMALY"
      ).length,
      totalLeads: bundle.leads.length,
      verifiedAdultLeads: bundle.leads.filter((l) => l.isAdult18).length,
      totalClaims: bundle.claims.length,
      anomaliesDetected: huntersLive.reduce(
        (sum, h) => sum + (h.anomalyFlags || 0),
        0
      ),
    },
    leaderboard: huntersLive,
    recentLeads: bundle.leads.slice(0, 15),
    recentClaims: bundle.claims.slice(0, 10),
    analytics: bi.analytics,
    heatmapPoints: bi.heatmapPoints,
    pushDispatchLogs: getRecentPushDispatchLogs()
      .filter((l) => l.brandSlug === brand.slug)
      .slice(0, 6),
  });
}
