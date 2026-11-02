import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Brand as PrismaBrand,
  BrandLead as PrismaBrandLead,
  Claim as PrismaClaim,
  CreditTransaction as PrismaCreditTx,
  Hunter as PrismaHunter,
  HunterMissionTelemetry as PrismaTelemetry,
  HunterPing as PrismaHunterPing,
  Mission as PrismaMission,
  PushSubscription as PrismaPushSub,
  ReusableQrNode as PrismaNode,
} from "@prisma/client";
import type {
  Brand,
  BrandAnalyticsSummary,
  BrandLead,
  CreditTransaction,
  DatabaseSchema,
  HeatmapPoint,
  Hunter,
  HunterMissionTelemetry,
  HunterPing,
  Mission,
  MissionClaim,
  MissionStatus,
  PublicBrand,
  PublicMission,
  PushSubscriptionRecord,
  ReusableQrNode,
  ThermalState,
} from "@/types/radar";
import { computePublicZoneCenter } from "@/lib/radar/geo";
import {
  fromPrismaThermal,
  getPrisma,
  isCloudDbEnabled,
} from "@/lib/db/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "radar-quest-db.json");

const globalForDb = globalThis as unknown as {
  __radarQuestDb?: DatabaseSchema;
};

// ============================================================================
// Prisma -> Domain Mappers
// ============================================================================

export function mapPrismaBrand(b: PrismaBrand): Brand {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    logoEmoji: b.logoEmoji,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    whatsapp: b.whatsapp,
    requireAdult18: b.requireAdult18,
    missionCredits: b.missionCredits,
    cityDefault: b.cityDefault,
    adminPin: b.adminPin,
    active: b.active,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export function mapPrismaMission(m: PrismaMission): Mission {
  return {
    id: m.id,
    brandId: m.brandId,
    title: m.title,
    city: m.city,
    zoneHint: m.zoneHint,
    secretLat: m.secretLat,
    secretLng: m.secretLng,
    publicCenterLat: m.publicCenterLat,
    publicCenterLng: m.publicCenterLng,
    captureRadiusMeters: m.captureRadiusMeters,
    zoneRadiusMeters: m.zoneRadiusMeters,
    qrToken: m.qrToken,
    nodeCode: m.nodeCode,
    prizeTitle: m.prizeTitle,
    consolationTitle: m.consolationTitle,
    minPingsForMajorPrize: m.minPingsForMajorPrize,
    status: m.status,
    winnerHunterId: m.winnerHunterId,
    winnerAlias: m.winnerAlias,
    winnerClaimCode: m.winnerClaimCode,
    capturedAt: m.capturedAt ? m.capturedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function mapPrismaNode(n: PrismaNode): ReusableQrNode {
  return {
    id: n.id,
    code: n.code,
    label: n.label,
    brandId: n.brandId,
    assignedMissionId: n.assignedMissionId,
    active: n.active,
    createdAt: n.createdAt.toISOString(),
  };
}

export function mapPrismaHunter(h: PrismaHunter): Hunter {
  return {
    id: h.id,
    alias: h.alias,
    whatsapp: h.whatsapp,
    isAdult18: h.isAdult18,
    createdAt: h.createdAt.toISOString(),
  };
}

export function mapPrismaTelemetry(
  t: PrismaTelemetry
): HunterMissionTelemetry {
  return {
    id: t.id,
    missionId: t.missionId,
    hunterId: t.hunterId,
    alias: t.alias,
    lastLat: t.lastLat,
    lastLng: t.lastLng,
    lastAccuracy: t.lastAccuracy,
    lastDistanceMeters: t.lastDistanceMeters,
    speedKmh: t.speedKmh,
    inVehicleMode: t.inVehicleMode,
    thermalState: fromPrismaThermal(t.thermalState),
    pingCount: t.pingCount,
    validHuntPings: t.validHuntPings,
    anomalyFlags: t.anomalyFlags,
    firstPingAt: t.firstPingAt.toISOString(),
    lastPingAt: t.lastPingAt.toISOString(),
  };
}

export function mapPrismaClaim(c: PrismaClaim): MissionClaim {
  return {
    id: c.id,
    missionId: c.missionId,
    brandId: c.brandId,
    hunterId: c.hunterId,
    alias: c.alias,
    whatsapp: c.whatsapp,
    claimType: c.claimType,
    couponCode: c.couponCode,
    prizeLabel: c.prizeLabel,
    distanceAtClaimMeters: c.distanceAtClaimMeters,
    accuracyAtClaimMeters: c.accuracyAtClaimMeters,
    effectiveRadiusMeters: c.effectiveRadiusMeters,
    proofOfHuntPassed: c.proofOfHuntPassed,
    whatsappRedeemUrl: c.whatsappRedeemUrl,
    claimedAt: c.claimedAt.toISOString(),
  };
}

export function mapPrismaLead(l: PrismaBrandLead): BrandLead {
  return {
    id: l.id,
    brandId: l.brandId,
    hunterId: l.hunterId,
    alias: l.alias,
    whatsapp: l.whatsapp,
    isAdult18: l.isAdult18,
    sourceMissionId: l.sourceMissionId,
    city: l.city || "Paraguay",
    createdAt: l.createdAt.toISOString(),
  };
}

export function mapPrismaCreditTx(tx: PrismaCreditTx): CreditTransaction {
  return {
    id: tx.id,
    brandId: tx.brandId,
    delta: tx.delta,
    reason: tx.reason,
    performedBy: tx.performedBy,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function mapPrismaPushSub(s: PrismaPushSub): PushSubscriptionRecord {
  return {
    id: s.id,
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth: s.auth,
    brandId: s.brandId,
    city: s.city,
    hunterId: s.hunterId,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function mapPrismaPing(p: PrismaHunterPing): HunterPing {
  return {
    id: p.id,
    missionId: p.missionId,
    hunterId: p.hunterId,
    alias: p.alias,
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    distanceMeters: p.distanceMeters,
    speedKmh: p.speedKmh,
    inVehicleMode: p.inVehicleMode,
    isAnomaly: p.isAnomaly,
    thermalState: fromPrismaThermal(p.thermalState),
    createdAt: p.createdAt.toISOString(),
  };
}

export function thermalStateToWeight(state: ThermalState): number {
  switch (state) {
    case "QUEMANDO":
      return 1.0;
    case "CALIENTE":
      return 0.8;
    case "TIBIO":
      return 0.55;
    case "CONGELADO":
      return 0.3;
    case "FUERA DE ZONA":
      return 0.16;
    case "TELEPORT_ANOMALY":
      return 0.08;
  }
}

export function normalizeCityKey(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ============================================================================
// Public DTO Sanitizers (Zero Secret Coordinate / PIN Leak)
// ============================================================================

export function toPublicBrand(brand: Brand): PublicBrand {
  const { adminPin: _pin, ...publicFields } = brand;
  void _pin;
  return publicFields;
}

export function toPublicMission(mission: Mission): PublicMission {
  return {
    id: mission.id,
    brandId: mission.brandId,
    title: mission.title,
    city: mission.city,
    zoneHint: mission.zoneHint,
    publicCenterLat: mission.publicCenterLat,
    publicCenterLng: mission.publicCenterLng,
    zoneRadiusMeters: mission.zoneRadiusMeters,
    prizeTitle: mission.prizeTitle,
    consolationTitle: mission.consolationTitle,
    minPingsForMajorPrize: mission.minPingsForMajorPrize,
    status: mission.status,
    winnerAlias: mission.winnerAlias,
    capturedAt: mission.capturedAt,
  };
}

// ============================================================================
// Local Seed Fallback (Used automatically when DATABASE_URL is not configured)
// ============================================================================

function buildInitialSeed(): DatabaseSchema {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recent1 = new Date(nowMs - 18_000).toISOString();
  const recent2 = new Date(nowMs - 32_000).toISOString();
  const recent3 = new Date(nowMs - 45_000).toISOString();
  const histCreated = new Date(nowMs - 7_200_000).toISOString();
  const histCaptured = new Date(nowMs - 7_200_000 + 21 * 60_000 + 30_000).toISOString();

  const brands: Brand[] = [
    {
      id: "brand_el_vape_club",
      slug: "el-vape-club",
      name: "El Vape Club",
      tagline: "Caza el Drop Urbano • Edición Oficial +18 Paraguay",
      logoEmoji: "vape",
      primaryColor: "#a855f7",
      secondaryColor: "#00f0ff",
      whatsapp: "+595981555420",
      requireAdult18: true,
      missionCredits: 12,
      cityDefault: "Encarnación",
      adminPin: "420420",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "brand_arcade_burger",
      slug: "arcade-burger",
      name: "Arcade Burger PY",
      tagline: "Encontrá el Ticket Dorado en tu Ciudad • 16-Bit Burgers",
      logoEmoji: "burger",
      primaryColor: "#f97316",
      secondaryColor: "#facc15",
      whatsapp: "+595982444777",
      requireAdult18: false,
      missionCredits: 8,
      cityDefault: "Asunción",
      adminPin: "161616",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const m1Center = computePublicZoneCenter(
    -27.3308,
    -55.8669,
    "msn_evc_enc_costanera"
  );
  const m2Center = computePublicZoneCenter(
    -27.3372,
    -55.8661,
    "msn_evc_enc_plaza"
  );
  const m3Center = computePublicZoneCenter(
    -25.2821,
    -57.6352,
    "msn_evc_asu_palma"
  );
  const m4Center = computePublicZoneCenter(
    -25.2846,
    -57.5632,
    "msn_evc_asu_morra"
  );
  const m5Center = computePublicZoneCenter(
    -25.2768,
    -57.6311,
    "msn_ab_asu_costanera"
  );

  const missions: Mission[] = [
    {
      id: "msn_evc_enc_costanera",
      brandId: "brand_el_vape_club",
      title: "Drop Nocturno: Costanera San José",
      city: "Encarnación",
      zoneHint:
        "Frente a la brisa del Paraná, cerca del Paseo Gastronómico y el histórico Molino. Seguí el pulso térmico.",
      secretLat: -27.3308,
      secretLng: -55.8669,
      publicCenterLat: m1Center.publicCenterLat,
      publicCenterLng: m1Center.publicCenterLng,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 3500,
      qrToken: "EVC-ENC-SANJOSE-2026",
      nodeCode: "RQ-NODE-ENC-01",
      prizeTitle: "Pod Edición Limitada 15K Puffs + Hoodie El Vape Club",
      consolationTitle: "Cupón Explorador Curioso: 20% OFF en tienda",
      minPingsForMajorPrize: 3,
      status: "ACTIVE",
      winnerHunterId: null,
      winnerAlias: null,
      winnerClaimCode: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msn_evc_enc_plaza",
      brandId: "brand_el_vape_club",
      title: "Cápsula Neón: Plaza de Armas",
      city: "Encarnación",
      zoneHint:
        "En el corazón verde de la Perla del Sur, entre senderos arbolados y luces urbanas.",
      secretLat: -27.3372,
      secretLng: -55.8661,
      publicCenterLat: m2Center.publicCenterLat,
      publicCenterLng: m2Center.publicCenterLng,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 3500,
      qrToken: "EVC-ENC-PLAZA-2026",
      nodeCode: "RQ-NODE-ENC-02",
      prizeTitle: "Kit VIP Vape Club + Mystery Box Neón",
      consolationTitle: "Cupón Explorador Curioso: 15% OFF en recargas",
      minPingsForMajorPrize: 3,
      status: "ACTIVE",
      winnerHunterId: null,
      winnerAlias: null,
      winnerClaimCode: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msn_evc_asu_palma",
      brandId: "brand_el_vape_club",
      title: "Bóveda Arcade: Calle Palma",
      city: "Asunción",
      zoneHint:
        "Donde late el centro histórico capitalino, a pasos de las banderas y fachadas clásicas.",
      secretLat: -25.2821,
      secretLng: -57.6352,
      publicCenterLat: m3Center.publicCenterLat,
      publicCenterLng: m3Center.publicCenterLng,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 4000,
      qrToken: "EVC-ASU-PALMA-2026",
      nodeCode: "RQ-NODE-ASU-01",
      prizeTitle: "Combo Dual Device + Acceso VIP Lanzamiento Asunción",
      consolationTitle: "Cupón Explorador Curioso: 20% OFF Sucursal Centro",
      minPingsForMajorPrize: 3,
      status: "ACTIVE",
      winnerHunterId: null,
      winnerAlias: null,
      winnerClaimCode: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msn_evc_asu_morra",
      brandId: "brand_el_vape_club",
      title: "Reliquia Vapor: Zona Villa Morra",
      city: "Asunción",
      zoneHint:
        "Entre cafés nocturnos y pasajes peatonales de Villa Morra. Estacioná antes de los últimos 100 metros.",
      secretLat: -25.2846,
      secretLng: -57.5632,
      publicCenterLat: m4Center.publicCenterLat,
      publicCenterLng: m4Center.publicCenterLng,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 4000,
      qrToken: "EVC-ASU-MORRA-2026",
      nodeCode: "RQ-NODE-ASU-02",
      prizeTitle: "Pack Aniversario El Vape Club + Gift Card Gs. 500.000",
      consolationTitle: "Cupón Explorador Curioso: 15% OFF Villa Morra",
      minPingsForMajorPrize: 3,
      status: "ACTIVE",
      winnerHunterId: null,
      winnerAlias: null,
      winnerClaimCode: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msn_ab_asu_costanera",
      brandId: "brand_arcade_burger",
      title: "Ticket Dorado: Costanera de Asunción",
      city: "Asunción",
      zoneHint:
        "Mirando a la bahía al atardecer, cerca del alquiler de kartings y bicis.",
      secretLat: -25.2768,
      secretLng: -57.6311,
      publicCenterLat: m5Center.publicCenterLat,
      publicCenterLng: m5Center.publicCenterLng,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 3500,
      qrToken: "AB-ASU-BAHIA-2026",
      nodeCode: "RQ-NODE-AB-01",
      prizeTitle: "1 Mes de Smash Burgers Gratis + Gorra Pixel Art",
      consolationTitle: "Cupón Explorador Curioso: Papas Cheddar Gratis",
      minPingsForMajorPrize: 3,
      status: "ACTIVE",
      winnerHunterId: null,
      winnerAlias: null,
      winnerClaimCode: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msn_evc_enc_silo_hist",
      brandId: "brand_el_vape_club",
      title: "Drop Relámpago: Silo & Molino San José",
      city: "Encarnación",
      zoneHint:
        "A metros de los íconos históricos frente al río Paraná en la Costanera.",
      secretLat: -27.3296,
      secretLng: -55.8685,
      publicCenterLat: -27.3311,
      publicCenterLng: -55.8698,
      captureRadiusMeters: 35,
      zoneRadiusMeters: 3500,
      qrToken: "EVC-ENC-SILO-HIST",
      nodeCode: null,
      prizeTitle: "Vape Kit Pro + Gorra Bordada Oficial",
      consolationTitle: "Cupón Explorador Curioso: 15% OFF",
      minPingsForMajorPrize: 3,
      status: "CAPTURED",
      winnerHunterId: "hnt_demo_nico",
      winnerAlias: "@nico_itapua",
      winnerClaimCode: "EVC-MAJOR-77A2",
      capturedAt: histCaptured,
      createdAt: histCreated,
      updatedAt: histCaptured,
    },
  ];

  const seedTrailOffsets: Array<{
    missionId: string;
    hunterId: string;
    alias: string;
    baseLat: number;
    baseLng: number;
    dLat: number;
    dLng: number;
    dist: number;
    state: ThermalState;
  }> = [
    // Costanera San José Encarnación dense heat cluster
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.0024, dLng: -0.0021, dist: 335, state: "TIBIO" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.0018, dLng: -0.0015, dist: 245, state: "TIBIO" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.0012, dLng: -0.0009, dist: 158, state: "CALIENTE" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.0008, dLng: -0.0006, dist: 105, state: "CALIENTE" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.0005, dLng: -0.0003, dist: 62, state: "CALIENTE" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3308, baseLng: -55.8669, dLat: -0.00018, dLng: -0.00015, dist: 24, state: "QUEMANDO" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_vale", alias: "@vale_vaperpy", baseLat: -27.3308, baseLng: -55.8669, dLat: 0.0021, dLng: -0.0019, dist: 298, state: "TIBIO" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_vale", alias: "@vale_vaperpy", baseLat: -27.3308, baseLng: -55.8669, dLat: 0.0014, dLng: -0.0011, dist: 189, state: "TIBIO" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_vale", alias: "@vale_vaperpy", baseLat: -27.3308, baseLng: -55.8669, dLat: 0.0009, dLng: -0.0007, dist: 121, state: "CALIENTE" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_vale", alias: "@vale_vaperpy", baseLat: -27.3308, baseLng: -55.8669, dLat: 0.0004, dLng: -0.0003, dist: 54, state: "CALIENTE" },
    { missionId: "msn_evc_enc_costanera", hunterId: "hnt_demo_vale", alias: "@vale_vaperpy", baseLat: -27.3308, baseLng: -55.8669, dLat: 0.00012, dLng: -0.0001, dist: 17, state: "QUEMANDO" },
    { missionId: "msn_evc_enc_silo_hist", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3296, baseLng: -55.8685, dLat: -0.0009, dLng: 0.0008, dist: 125, state: "CALIENTE" },
    { missionId: "msn_evc_enc_silo_hist", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3296, baseLng: -55.8685, dLat: -0.0004, dLng: 0.0003, dist: 52, state: "CALIENTE" },
    { missionId: "msn_evc_enc_silo_hist", hunterId: "hnt_demo_nico", alias: "@nico_itapua", baseLat: -27.3296, baseLng: -55.8685, dLat: -0.0001, dLng: 0.00009, dist: 14, state: "QUEMANDO" },
    { missionId: "msn_evc_enc_silo_hist", hunterId: "hnt_demo_sofi", alias: "@sofi_arcade", baseLat: -27.3296, baseLng: -55.8685, dLat: 0.0003, dLng: 0.00025, dist: 41, state: "CALIENTE" },
    { missionId: "msn_evc_enc_silo_hist", hunterId: "hnt_demo_sofi", alias: "@sofi_arcade", baseLat: -27.3296, baseLng: -55.8685, dLat: 0.00011, dLng: 0.00008, dist: 16, state: "QUEMANDO" },
    // Plaza de Armas Encarnación
    { missionId: "msn_evc_enc_plaza", hunterId: "hnt_demo_sofi", alias: "@sofi_arcade", baseLat: -27.3372, baseLng: -55.8661, dLat: -0.0015, dLng: 0.0012, dist: 205, state: "TIBIO" },
    { missionId: "msn_evc_enc_plaza", hunterId: "hnt_demo_sofi", alias: "@sofi_arcade", baseLat: -27.3372, baseLng: -55.8661, dLat: -0.0007, dLng: 0.0006, dist: 96, state: "CALIENTE" },
    { missionId: "msn_evc_enc_plaza", hunterId: "hnt_demo_sofi", alias: "@sofi_arcade", baseLat: -27.3372, baseLng: -55.8661, dLat: -0.0002, dLng: 0.00018, dist: 28, state: "QUEMANDO" },
    // Calle Palma Asunción
    { missionId: "msn_evc_asu_palma", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2821, baseLng: -57.6352, dLat: -0.0019, dLng: -0.0016, dist: 264, state: "TIBIO" },
    { missionId: "msn_evc_asu_palma", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2821, baseLng: -57.6352, dLat: -0.0011, dLng: -0.0009, dist: 152, state: "CALIENTE" },
    { missionId: "msn_evc_asu_palma", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2821, baseLng: -57.6352, dLat: -0.0005, dLng: -0.0004, dist: 68, state: "CALIENTE" },
    { missionId: "msn_evc_asu_palma", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2821, baseLng: -57.6352, dLat: -0.00015, dLng: -0.00012, dist: 21, state: "QUEMANDO" },
    // Villa Morra Asunción
    { missionId: "msn_evc_asu_morra", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2846, baseLng: -57.5632, dLat: 0.0013, dLng: -0.0012, dist: 185, state: "TIBIO" },
    { missionId: "msn_evc_asu_morra", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2846, baseLng: -57.5632, dLat: 0.0006, dLng: -0.0005, dist: 84, state: "CALIENTE" },
    // Arcade Burger Costanera Asunción
    { missionId: "msn_ab_asu_costanera", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2768, baseLng: -57.6311, dLat: -0.0012, dLng: -0.0011, dist: 171, state: "CALIENTE" },
    { missionId: "msn_ab_asu_costanera", hunterId: "hnt_demo_mati", alias: "@mati_asu99", baseLat: -25.2768, baseLng: -57.6311, dLat: -0.0003, dLng: -0.0002, dist: 38, state: "CALIENTE" },
  ];

  const seededHunterPings: HunterPing[] = seedTrailOffsets.map((pt, idx) => ({
    id: `ping_seed_${idx + 1}`,
    missionId: pt.missionId,
    hunterId: pt.hunterId,
    alias: pt.alias,
    lat: Number((pt.baseLat + pt.dLat).toFixed(6)),
    lng: Number((pt.baseLng + pt.dLng).toFixed(6)),
    accuracy: 9,
    distanceMeters: pt.dist,
    speedKmh: 4.9,
    inVehicleMode: false,
    isAnomaly: false,
    thermalState: pt.state,
    createdAt: new Date(nowMs - (seedTrailOffsets.length - idx) * 60_000).toISOString(),
  }));

  return {
    brands,
    reusableNodes: [
      {
        id: "node_enc_01",
        code: "RQ-NODE-ENC-01",
        label: "Placa Acrílica QR #01 - Costanera Encarnación",
        brandId: "brand_el_vape_club",
        assignedMissionId: "msn_evc_enc_costanera",
        active: true,
        createdAt: now,
      },
      {
        id: "node_enc_02",
        code: "RQ-NODE-ENC-02",
        label: "Placa Acrílica QR #02 - Centro Encarnación",
        brandId: "brand_el_vape_club",
        assignedMissionId: "msn_evc_enc_plaza",
        active: true,
        createdAt: now,
      },
      {
        id: "node_asu_01",
        code: "RQ-NODE-ASU-01",
        label: "Sticker Blindado QR #01 - Calle Palma Asunción",
        brandId: "brand_el_vape_club",
        assignedMissionId: "msn_evc_asu_palma",
        active: true,
        createdAt: now,
      },
      {
        id: "node_asu_02",
        code: "RQ-NODE-ASU-02",
        label: "Sticker Blindado QR #02 - Villa Morra Asunción",
        brandId: "brand_el_vape_club",
        assignedMissionId: "msn_evc_asu_morra",
        active: true,
        createdAt: now,
      },
      {
        id: "node_ab_01",
        code: "RQ-NODE-AB-01",
        label: "Totem QR #01 - Arcade Burger Bahía",
        brandId: "brand_arcade_burger",
        assignedMissionId: "msn_ab_asu_costanera",
        active: true,
        createdAt: now,
      },
    ],
    missions,
    hunters: [
      {
        id: "hnt_demo_nico",
        alias: "@nico_itapua",
        whatsapp: "+595971882101",
        isAdult18: true,
        createdAt: now,
      },
      {
        id: "hnt_demo_vale",
        alias: "@vale_vaperpy",
        whatsapp: "+595981443210",
        isAdult18: true,
        createdAt: now,
      },
      {
        id: "hnt_demo_mati",
        alias: "@mati_asu99",
        whatsapp: "+595985301992",
        isAdult18: true,
        createdAt: now,
      },
      {
        id: "hnt_demo_sofi",
        alias: "@sofi_arcade",
        whatsapp: "+595982610440",
        isAdult18: true,
        createdAt: now,
      },
    ],
    hunterPings: seededHunterPings,
    leads: [
      {
        id: "lead_1",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_nico",
        alias: "@nico_itapua",
        whatsapp: "+595971882101",
        isAdult18: true,
        sourceMissionId: "msn_evc_enc_costanera",
        city: "Encarnación",
        createdAt: now,
      },
      {
        id: "lead_2",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_vale",
        alias: "@vale_vaperpy",
        whatsapp: "+595981443210",
        isAdult18: true,
        sourceMissionId: "msn_evc_enc_costanera",
        city: "Encarnación",
        createdAt: now,
      },
      {
        id: "lead_3",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_mati",
        alias: "@mati_asu99",
        whatsapp: "+595985301992",
        isAdult18: true,
        sourceMissionId: "msn_evc_asu_palma",
        city: "Asunción",
        createdAt: now,
      },
      {
        id: "lead_4",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_sofi",
        alias: "@sofi_arcade",
        whatsapp: "+595982610440",
        isAdult18: true,
        sourceMissionId: "msn_evc_enc_plaza",
        city: "Encarnación",
        createdAt: now,
      },
    ],
    telemetry: [
      {
        id: "tel_demo_1",
        missionId: "msn_evc_enc_costanera",
        hunterId: "hnt_demo_nico",
        alias: "@nico_itapua",
        lastLat: -27.3314,
        lastLng: -55.8673,
        lastAccuracy: 9,
        lastDistanceMeters: 78,
        speedKmh: 5.2,
        inVehicleMode: false,
        thermalState: "CALIENTE",
        pingCount: 9,
        validHuntPings: 9,
        anomalyFlags: 0,
        firstPingAt: recent3,
        lastPingAt: recent1,
      },
      {
        id: "tel_demo_2",
        missionId: "msn_evc_enc_costanera",
        hunterId: "hnt_demo_vale",
        alias: "@vale_vaperpy",
        lastLat: -27.3335,
        lastLng: -55.8692,
        lastAccuracy: 14,
        lastDistanceMeters: 376,
        speedKmh: 38.4,
        inVehicleMode: true,
        thermalState: "TIBIO",
        pingCount: 5,
        validHuntPings: 5,
        anomalyFlags: 0,
        firstPingAt: recent3,
        lastPingAt: recent2,
      },
      {
        id: "tel_demo_3",
        missionId: "msn_evc_asu_palma",
        hunterId: "hnt_demo_mati",
        alias: "@mati_asu99",
        lastLat: -25.2831,
        lastLng: -57.6361,
        lastAccuracy: 11,
        lastDistanceMeters: 143,
        speedKmh: 4.8,
        inVehicleMode: false,
        thermalState: "CALIENTE",
        pingCount: 6,
        validHuntPings: 6,
        anomalyFlags: 0,
        firstPingAt: recent3,
        lastPingAt: recent1,
      },
    ],
    claims: [
      {
        id: "claim_hist_1",
        missionId: "msn_evc_enc_silo_hist",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_nico",
        alias: "@nico_itapua",
        whatsapp: "+595971882101",
        claimType: "MAJOR_PRIZE",
        couponCode: "EVC-MAJOR-77A2",
        prizeLabel: "Vape Kit Pro + Gorra Bordada Oficial",
        distanceAtClaimMeters: 14.2,
        accuracyAtClaimMeters: 8.5,
        effectiveRadiusMeters: 39.3,
        proofOfHuntPassed: true,
        whatsappRedeemUrl: "https://wa.me/595981555420?text=Canje%20EVC-MAJOR-77A2",
        claimedAt: histCaptured,
      },
      {
        id: "claim_hist_2",
        missionId: "msn_evc_enc_silo_hist",
        brandId: "brand_el_vape_club",
        hunterId: "hnt_demo_sofi",
        alias: "@sofi_arcade",
        whatsapp: "+595982610440",
        claimType: "CONSOLATION_LATE",
        couponCode: "EVC-CURIOUS-91B4",
        prizeLabel: "Cupón Explorador Curioso: 15% OFF",
        distanceAtClaimMeters: 16.4,
        accuracyAtClaimMeters: 9.0,
        effectiveRadiusMeters: 39.5,
        proofOfHuntPassed: true,
        whatsappRedeemUrl: "https://wa.me/595981555420?text=Canje%20EVC-CURIOUS-91B4",
        claimedAt: new Date(nowMs - 7_200_000 + 28 * 60_000).toISOString(),
      },
    ],
    creditLedger: [
      {
        id: "crd_init_evc",
        brandId: "brand_el_vape_club",
        delta: 12,
        reason: "Paquete Inicial Lanzamiento Nacional (Encarnación + Asunción)",
        performedBy: "CeroUno Studio Super-Admin",
        createdAt: now,
      },
      {
        id: "crd_init_ab",
        brandId: "brand_arcade_burger",
        delta: 8,
        reason: "Paquete Demo Gastronómico White-Label",
        performedBy: "CeroUno Studio Super-Admin",
        createdAt: now,
      },
    ],
    pushSubscriptions: [],
  };
}

export function getDb(): DatabaseSchema {
  if (globalForDb.__radarQuestDb) {
    return globalForDb.__radarQuestDb;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.brands) && parsed.brands.length > 0) {
        // Ensure Phase 2 & Phase 3 fields exist on upgraded snapshots
        parsed.hunterPings = parsed.hunterPings || [];
        parsed.pushSubscriptions = parsed.pushSubscriptions || [];
        for (const b of parsed.brands) {
          if (!b.adminPin) {
            b.adminPin = b.slug === "arcade-burger" ? "161616" : "420420";
          }
          if (b.logoEmoji === "💨") b.logoEmoji = "vape";
          if (b.logoEmoji === "🍔") b.logoEmoji = "burger";
          if (b.logoEmoji === "🕹️") b.logoEmoji = "radar";
        }
        globalForDb.__radarQuestDb = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[RadarQuest DB] Re-initializing seed store:", err);
  }

  const seeded = buildInitialSeed();
  globalForDb.__radarQuestDb = seeded;
  persistDb(seeded);
  return seeded;
}

export function persistDb(db: DatabaseSchema = getDb()): void {
  globalForDb.__radarQuestDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.warn("[RadarQuest DB] Disk persistence skipped:", err);
  }
}

// ============================================================================
// Unified Async Multi-Tenant Cloud Repository (Prisma PostgreSQL + Fallback)
// ============================================================================

export async function findBrandBySlug(slug: string): Promise<Brand | null> {
  const clean = slug.trim().toLowerCase();
  if (isCloudDbEnabled()) {
    const row = await getPrisma().brand.findUnique({ where: { slug: clean } });
    return row ? mapPrismaBrand(row) : null;
  }
  const db = getDb();
  return db.brands.find((b) => b.slug.toLowerCase() === clean) || null;
}

export async function listActiveBrandsWithPublicMissions(): Promise<
  Array<{
    brand: PublicBrand;
    missionsCount: number;
    activeMissionsCount: number;
    missions: PublicMission[];
  }>
> {
  if (isCloudDbEnabled()) {
    const rows = await getPrisma().brand.findMany({
      where: { active: true },
      include: {
        missions: {
          where: { status: { not: "DRAFT" } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => {
      const brand = toPublicBrand(mapPrismaBrand(r));
      const missions = r.missions.map((m) =>
        toPublicMission(mapPrismaMission(m))
      );
      return {
        brand,
        missionsCount: missions.length,
        activeMissionsCount: missions.filter((m) => m.status === "ACTIVE")
          .length,
        missions,
      };
    });
  }

  const db = getDb();
  return db.brands
    .filter((b) => b.active)
    .map((b) => {
      const missions = db.missions
        .filter((m) => m.brandId === b.id && m.status !== "DRAFT")
        .map(toPublicMission);
      return {
        brand: toPublicBrand(b),
        missionsCount: missions.length,
        activeMissionsCount: missions.filter((m) => m.status === "ACTIVE")
          .length,
        missions,
      };
    });
}

export async function listPublicMissionsForBrand(
  brandId: string
): Promise<PublicMission[]> {
  if (isCloudDbEnabled()) {
    const rows = await getPrisma().mission.findMany({
      where: { brandId, status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((m) => toPublicMission(mapPrismaMission(m)));
  }

  const db = getDb();
  return db.missions
    .filter((m) => m.brandId === brandId && m.status !== "DRAFT")
    .map(toPublicMission);
}

export async function findMissionById(
  missionId: string
): Promise<Mission | null> {
  if (isCloudDbEnabled()) {
    const row = await getPrisma().mission.findUnique({
      where: { id: missionId },
    });
    return row ? mapPrismaMission(row) : null;
  }
  return getDb().missions.find((m) => m.id === missionId) || null;
}

export async function findHunterById(hunterId: string): Promise<Hunter | null> {
  if (isCloudDbEnabled()) {
    const row = await getPrisma().hunter.findUnique({
      where: { id: hunterId },
    });
    return row ? mapPrismaHunter(row) : null;
  }
  return getDb().hunters.find((h) => h.id === hunterId) || null;
}

export async function upsertHunterAndLead(params: {
  alias: string;
  whatsapp: string;
  isAdult18: boolean;
  brand: Brand;
  sourceMissionId: string | null;
}): Promise<Hunter> {
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const sourceMission = params.sourceMissionId
      ? await prisma.mission.findUnique({
          where: { id: params.sourceMissionId },
          select: { city: true },
        })
      : null;

    const hunter = await prisma.hunter.upsert({
      where: { whatsapp: params.whatsapp },
      update: {
        alias: params.alias,
        ...(params.isAdult18 ? { isAdult18: true } : {}),
      },
      create: {
        alias: params.alias,
        whatsapp: params.whatsapp,
        isAdult18: params.isAdult18,
      },
    });

    await prisma.brandLead.upsert({
      where: {
        brandId_whatsapp: {
          brandId: params.brand.id,
          whatsapp: params.whatsapp,
        },
      },
      update: {
        alias: params.alias,
        ...(params.isAdult18 ? { isAdult18: true } : {}),
      },
      create: {
        brandId: params.brand.id,
        hunterId: hunter.id,
        alias: params.alias,
        whatsapp: params.whatsapp,
        isAdult18: hunter.isAdult18,
        sourceMissionId: params.sourceMissionId,
        city: sourceMission?.city || params.brand.cityDefault,
      },
    });

    return mapPrismaHunter(hunter);
  }

  const db = getDb();
  const now = new Date().toISOString();
  let hunter = db.hunters.find((h) => h.whatsapp === params.whatsapp);
  if (!hunter) {
    hunter = {
      id: `hnt_${crypto.randomUUID().slice(0, 10)}`,
      alias: params.alias,
      whatsapp: params.whatsapp,
      isAdult18: params.isAdult18,
      createdAt: now,
    };
    db.hunters.push(hunter);
  } else {
    hunter.alias = params.alias;
    if (params.isAdult18) hunter.isAdult18 = true;
  }

  const existingLead = db.leads.find(
    (l) => l.brandId === params.brand.id && l.whatsapp === params.whatsapp
  );
  const sourceMission = params.sourceMissionId
    ? db.missions.find((m) => m.id === params.sourceMissionId)
    : undefined;

  if (!existingLead) {
    db.leads.unshift({
      id: `lead_${crypto.randomUUID().slice(0, 10)}`,
      brandId: params.brand.id,
      hunterId: hunter.id,
      alias: params.alias,
      whatsapp: params.whatsapp,
      isAdult18: hunter.isAdult18,
      sourceMissionId: params.sourceMissionId,
      city: sourceMission?.city || params.brand.cityDefault,
      createdAt: now,
    });
  } else {
    existingLead.alias = params.alias;
    if (params.isAdult18) existingLead.isAdult18 = true;
  }

  persistDb(db);
  return hunter;
}

export async function getBrandAdminBundle(brandId: string): Promise<{
  missions: Mission[];
  reusableNodes: ReusableQrNode[];
  leads: BrandLead[];
  claims: MissionClaim[];
  telemetry: HunterMissionTelemetry[];
}> {
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const [missions, reusableNodes, leads, claims] = await Promise.all([
      prisma.mission.findMany({
        where: { brandId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reusableQrNode.findMany({
        where: { brandId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.brandLead.findMany({
        where: { brandId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.claim.findMany({
        where: { brandId },
        orderBy: { claimedAt: "desc" },
      }),
    ]);

    const missionIds = missions.map((m) => m.id);
    const telemetry =
      missionIds.length > 0
        ? await prisma.hunterMissionTelemetry.findMany({
            where: { missionId: { in: missionIds } },
            orderBy: { lastDistanceMeters: "asc" },
          })
        : [];

    return {
      missions: missions.map(mapPrismaMission),
      reusableNodes: reusableNodes.map(mapPrismaNode),
      leads: leads.map(mapPrismaLead),
      claims: claims.map(mapPrismaClaim),
      telemetry: telemetry.map(mapPrismaTelemetry),
    };
  }

  const db = getDb();
  const missions = db.missions.filter((m) => m.brandId === brandId);
  const missionIds = new Set(missions.map((m) => m.id));
  return {
    missions,
    reusableNodes: db.reusableNodes.filter((n) => n.brandId === brandId),
    leads: db.leads.filter((l) => l.brandId === brandId),
    claims: db.claims.filter((c) => c.brandId === brandId),
    telemetry: db.telemetry.filter((t) => missionIds.has(t.missionId)),
  };
}

export async function createMissionRecord(params: {
  brand: Brand;
  title: string;
  city: string;
  zoneHint: string;
  secretLat: number;
  secretLng: number;
  captureRadiusMeters: number;
  zoneRadiusMeters: number;
  nodeCode: string | null;
  prizeTitle: string;
  consolationTitle: string;
  minPingsForMajorPrize: number;
}): Promise<{ mission: Mission; remainingCredits: number }> {
  const missionId = `msn_${crypto.randomUUID().slice(0, 10)}`;
  const qrToken = `${params.brand.slug
    .slice(0, 3)
    .toUpperCase()}-${params.city
    .slice(0, 3)
    .toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const { publicCenterLat, publicCenterLng } = computePublicZoneCenter(
    params.secretLat,
    params.secretLng,
    missionId
  );

  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const freshBrand = await tx.brand.findUnique({
        where: { id: params.brand.id },
      });
      if (!freshBrand || freshBrand.missionCredits <= 0) {
        throw new Error(
          "Sin créditos de misiones disponibles. Solicitá recarga a CeroUno Studio."
        );
      }

      const updatedBrand = await tx.brand.update({
        where: { id: params.brand.id },
        data: { missionCredits: { decrement: 1 } },
      });

      await tx.creditTransaction.create({
        data: {
          brandId: params.brand.id,
          delta: -1,
          reason: `Activación de misión: ${params.title} (${params.city})`,
          performedBy: `Panel Comercio (${params.brand.name})`,
        },
      });

      const created = await tx.mission.create({
        data: {
          id: missionId,
          brandId: params.brand.id,
          title: params.title,
          city: params.city,
          zoneHint: params.zoneHint,
          secretLat: Number(params.secretLat.toFixed(6)),
          secretLng: Number(params.secretLng.toFixed(6)),
          publicCenterLat,
          publicCenterLng,
          captureRadiusMeters: params.captureRadiusMeters,
          zoneRadiusMeters: params.zoneRadiusMeters,
          qrToken,
          nodeCode: params.nodeCode,
          prizeTitle: params.prizeTitle,
          consolationTitle: params.consolationTitle,
          minPingsForMajorPrize: params.minPingsForMajorPrize,
          status: "ACTIVE",
        },
      });

      if (params.nodeCode) {
        await tx.reusableQrNode.updateMany({
          where: { brandId: params.brand.id, code: params.nodeCode },
          data: { assignedMissionId: created.id },
        });
      }

      return {
        mission: mapPrismaMission(created),
        remainingCredits: updatedBrand.missionCredits,
      };
    });
  }

  const db = getDb();
  const brandRef = db.brands.find((b) => b.id === params.brand.id);
  if (!brandRef || brandRef.missionCredits <= 0) {
    throw new Error(
      "Sin créditos de misiones disponibles. Solicitá recarga a CeroUno Studio."
    );
  }

  const now = new Date().toISOString();
  const newMission: Mission = {
    id: missionId,
    brandId: brandRef.id,
    title: params.title,
    city: params.city,
    zoneHint: params.zoneHint,
    secretLat: Number(params.secretLat.toFixed(6)),
    secretLng: Number(params.secretLng.toFixed(6)),
    publicCenterLat,
    publicCenterLng,
    captureRadiusMeters: params.captureRadiusMeters,
    zoneRadiusMeters: params.zoneRadiusMeters,
    qrToken,
    nodeCode: params.nodeCode,
    prizeTitle: params.prizeTitle,
    consolationTitle: params.consolationTitle,
    minPingsForMajorPrize: params.minPingsForMajorPrize,
    status: "ACTIVE",
    winnerHunterId: null,
    winnerAlias: null,
    winnerClaimCode: null,
    capturedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  brandRef.missionCredits -= 1;
  brandRef.updatedAt = now;
  db.creditLedger.unshift({
    id: `crd_${crypto.randomUUID().slice(0, 8)}`,
    brandId: brandRef.id,
    delta: -1,
    reason: `Activación de misión: ${params.title} (${params.city})`,
    performedBy: `Panel Comercio (${brandRef.name})`,
    createdAt: now,
  });

  if (params.nodeCode) {
    const node = db.reusableNodes.find(
      (n) => n.brandId === brandRef.id && n.code === params.nodeCode
    );
    if (node) node.assignedMissionId = newMission.id;
  }

  db.missions.unshift(newMission);
  persistDb(db);

  return { mission: newMission, remainingCredits: brandRef.missionCredits };
}

export async function updateMissionRecord(params: {
  missionId: string;
  secretLat?: number;
  secretLng?: number;
  title?: string;
  city?: string;
  zoneHint?: string;
  prizeTitle?: string;
  status?: MissionStatus;
  resetWinner?: boolean;
  nodeCode?: string | null;
}): Promise<Mission | null> {
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const existing = await prisma.mission.findUnique({
      where: { id: params.missionId },
    });
    if (!existing) return null;

    let coordsPatch = {};
    if (params.secretLat !== undefined && params.secretLng !== undefined) {
      const pub = computePublicZoneCenter(
        params.secretLat,
        params.secretLng,
        existing.id
      );
      coordsPatch = {
        secretLat: Number(params.secretLat.toFixed(6)),
        secretLng: Number(params.secretLng.toFixed(6)),
        publicCenterLat: pub.publicCenterLat,
        publicCenterLng: pub.publicCenterLng,
      };
    }

    const updated = await prisma.mission.update({
      where: { id: existing.id },
      data: {
        ...coordsPatch,
        ...(params.title ? { title: params.title } : {}),
        ...(params.city ? { city: params.city } : {}),
        ...(params.zoneHint ? { zoneHint: params.zoneHint } : {}),
        ...(params.prizeTitle ? { prizeTitle: params.prizeTitle } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.status === "ACTIVE" && params.resetWinner
          ? {
              winnerHunterId: null,
              winnerAlias: null,
              winnerClaimCode: null,
              capturedAt: null,
            }
          : {}),
        ...(params.nodeCode !== undefined ? { nodeCode: params.nodeCode } : {}),
      },
    });

    if (params.nodeCode) {
      await prisma.reusableQrNode.updateMany({
        where: { brandId: existing.brandId, code: params.nodeCode },
        data: { assignedMissionId: existing.id },
      });
    }

    return mapPrismaMission(updated);
  }

  const db = getDb();
  const mission = db.missions.find((m) => m.id === params.missionId);
  if (!mission) return null;

  if (params.secretLat !== undefined && params.secretLng !== undefined) {
    mission.secretLat = Number(params.secretLat.toFixed(6));
    mission.secretLng = Number(params.secretLng.toFixed(6));
    const pub = computePublicZoneCenter(
      params.secretLat,
      params.secretLng,
      mission.id
    );
    mission.publicCenterLat = pub.publicCenterLat;
    mission.publicCenterLng = pub.publicCenterLng;
  }

  if (params.title) mission.title = params.title;
  if (params.city) mission.city = params.city;
  if (params.zoneHint) mission.zoneHint = params.zoneHint;
  if (params.prizeTitle) mission.prizeTitle = params.prizeTitle;
  if (params.status) {
    mission.status = params.status;
    if (params.status === "ACTIVE" && params.resetWinner) {
      mission.winnerHunterId = null;
      mission.winnerAlias = null;
      mission.winnerClaimCode = null;
      mission.capturedAt = null;
    }
  }
  if (params.nodeCode !== undefined) {
    mission.nodeCode = params.nodeCode;
    if (params.nodeCode) {
      const node = db.reusableNodes.find(
        (n) => n.brandId === mission.brandId && n.code === params.nodeCode
      );
      if (node) node.assignedMissionId = mission.id;
    }
  }
  mission.updatedAt = new Date().toISOString();
  persistDb(db);
  return mission;
}

// ============================================================================
// Phase 3: Web Push Subscriptions & BI Heatmap Analytics
// ============================================================================

export async function upsertPushSubscription(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
  brandId: string;
  city: string;
  hunterId: string | null;
}): Promise<PushSubscriptionRecord> {
  const cleanCity = params.city.trim() || "Encarnación";

  if (isCloudDbEnabled()) {
    const row = await getPrisma().pushSubscription.upsert({
      where: { endpoint: params.endpoint },
      update: {
        p256dh: params.p256dh,
        auth: params.auth,
        brandId: params.brandId,
        city: cleanCity,
        hunterId: params.hunterId,
        active: true,
      },
      create: {
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        brandId: params.brandId,
        city: cleanCity,
        hunterId: params.hunterId,
        active: true,
      },
    });
    return mapPrismaPushSub(row);
  }

  const db = getDb();
  const now = new Date().toISOString();
  let sub = db.pushSubscriptions.find((s) => s.endpoint === params.endpoint);

  if (sub) {
    sub.p256dh = params.p256dh;
    sub.auth = params.auth;
    sub.brandId = params.brandId;
    sub.city = cleanCity;
    sub.hunterId = params.hunterId;
    sub.active = true;
    sub.updatedAt = now;
  } else {
    sub = {
      id: `push_${crypto.randomUUID().slice(0, 10)}`,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      brandId: params.brandId,
      city: cleanCity,
      hunterId: params.hunterId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    db.pushSubscriptions.unshift(sub);
  }

  persistDb(db);
  return sub;
}

export async function listActivePushSubscriptionsForCity(
  brandId: string,
  city: string
): Promise<PushSubscriptionRecord[]> {
  const targetKey = normalizeCityKey(city);

  if (isCloudDbEnabled()) {
    const rows = await getPrisma().pushSubscription.findMany({
      where: { brandId, active: true },
    });
    return rows
      .filter((r) => normalizeCityKey(r.city) === targetKey)
      .map(mapPrismaPushSub);
  }

  const db = getDb();
  return db.pushSubscriptions.filter(
    (s) =>
      s.brandId === brandId &&
      s.active &&
      normalizeCityKey(s.city) === targetKey
  );
}

export async function deactivatePushSubscription(
  endpoint: string
): Promise<void> {
  if (isCloudDbEnabled()) {
    await getPrisma().pushSubscription.updateMany({
      where: { endpoint },
      data: { active: false },
    });
    return;
  }

  const db = getDb();
  const sub = db.pushSubscriptions.find((s) => s.endpoint === endpoint);
  if (sub) {
    sub.active = false;
    sub.updatedAt = new Date().toISOString();
    persistDb(db);
  }
}

export async function getBrandHeatmapAndAnalytics(brandId: string): Promise<{
  heatmapPoints: HeatmapPoint[];
  analytics: BrandAnalyticsSummary;
}> {
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const [missions, leads, claims, pushSubscribersCount] = await Promise.all([
      prisma.mission.findMany({
        where: { brandId },
        select: { id: true, status: true, createdAt: true, capturedAt: true },
      }),
      prisma.brandLead.findMany({
        where: { brandId },
        select: { hunterId: true },
      }),
      prisma.claim.findMany({
        where: { brandId },
        select: { hunterId: true },
      }),
      prisma.pushSubscription.count({
        where: { brandId, active: true },
      }),
    ]);

    const missionIds = missions.map((m) => m.id);
    const [pings, telemetry, totalHistoricalPings] =
      missionIds.length > 0
        ? await Promise.all([
            prisma.hunterPing.findMany({
              where: { missionId: { in: missionIds }, isAnomaly: false },
              orderBy: { createdAt: "desc" },
              take: 1500,
              select: {
                lat: true,
                lng: true,
                thermalState: true,
                missionId: true,
                hunterId: true,
              },
            }),
            prisma.hunterMissionTelemetry.findMany({
              where: { missionId: { in: missionIds } },
              select: {
                lastLat: true,
                lastLng: true,
                thermalState: true,
                missionId: true,
                hunterId: true,
              },
            }),
            prisma.hunterPing.count({
              where: { missionId: { in: missionIds } },
            }),
          ])
        : [[], [], 0];

    const uniqueSet = new Set<string>();
    for (const l of leads) uniqueSet.add(l.hunterId);
    for (const c of claims) uniqueSet.add(c.hunterId);
    for (const t of telemetry) uniqueSet.add(t.hunterId);
    for (const p of pings) uniqueSet.add(p.hunterId);

    const claimHunters = new Set<string>(claims.map((c) => c.hunterId));
    const uniqueHunters = uniqueSet.size;

    const capturedDurations = missions
      .filter((m) => m.status === "CAPTURED" && m.capturedAt !== null)
      .map((m) =>
        Math.max(
          0.5,
          ((m.capturedAt as Date).getTime() - m.createdAt.getTime()) / 60_000
        )
      );

    const avgCaptureMinutes =
      capturedDurations.length > 0
        ? Number(
            (
              capturedDurations.reduce((acc, d) => acc + d, 0) /
              capturedDurations.length
            ).toFixed(1)
          )
        : null;

    const claimConversionRate =
      uniqueHunters > 0
        ? Number(
            Math.min(100, (claimHunters.size / uniqueHunters) * 100).toFixed(1)
          )
        : 0;

    const heatmapPoints: HeatmapPoint[] = pings.map((p) => {
      const state = fromPrismaThermal(p.thermalState);
      return {
        lat: p.lat,
        lng: p.lng,
        weight: thermalStateToWeight(state),
        thermalState: state,
        missionId: p.missionId,
      };
    });

    for (const t of telemetry) {
      const state = fromPrismaThermal(t.thermalState);
      heatmapPoints.push({
        lat: t.lastLat,
        lng: t.lastLng,
        weight: thermalStateToWeight(state),
        thermalState: state,
        missionId: t.missionId,
      });
    }

    return {
      heatmapPoints,
      analytics: {
        uniqueHunters,
        avgCaptureMinutes,
        claimConversionRate,
        totalHistoricalPings,
        pushSubscribersCount,
      },
    };
  }

  // Local store fallback
  const db = getDb();
  const missions = db.missions.filter((m) => m.brandId === brandId);
  const missionIds = new Set(missions.map((m) => m.id));
  const leads = db.leads.filter((l) => l.brandId === brandId);
  const claims = db.claims.filter((c) => c.brandId === brandId);
  const telemetry = db.telemetry.filter((t) => missionIds.has(t.missionId));
  const allBrandPings = db.hunterPings.filter((p) =>
    missionIds.has(p.missionId)
  );
  const validPings = allBrandPings.filter((p) => !p.isAnomaly).slice(0, 1500);

  const uniqueSet = new Set<string>();
  for (const l of leads) uniqueSet.add(l.hunterId);
  for (const c of claims) uniqueSet.add(c.hunterId);
  for (const t of telemetry) uniqueSet.add(t.hunterId);
  for (const p of allBrandPings) uniqueSet.add(p.hunterId);

  const claimHunters = new Set<string>(claims.map((c) => c.hunterId));
  const uniqueHunters = uniqueSet.size;

  const capturedDurations = missions
    .filter((m) => m.status === "CAPTURED" && Boolean(m.capturedAt))
    .map((m) =>
      Math.max(
        0.5,
        (new Date(m.capturedAt as string).getTime() -
          new Date(m.createdAt).getTime()) /
          60_000
      )
    );

  const avgCaptureMinutes =
    capturedDurations.length > 0
      ? Number(
          (
            capturedDurations.reduce((acc, d) => acc + d, 0) /
            capturedDurations.length
          ).toFixed(1)
        )
      : null;

  const claimConversionRate =
    uniqueHunters > 0
      ? Number(
          Math.min(100, (claimHunters.size / uniqueHunters) * 100).toFixed(1)
        )
      : 0;

  const pushSubscribersCount = db.pushSubscriptions.filter(
    (s) => s.brandId === brandId && s.active
  ).length;

  const heatmapPoints: HeatmapPoint[] = validPings.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    weight: thermalStateToWeight(p.thermalState),
    thermalState: p.thermalState,
    missionId: p.missionId,
  }));

  for (const t of telemetry) {
    heatmapPoints.push({
      lat: t.lastLat,
      lng: t.lastLng,
      weight: thermalStateToWeight(t.thermalState),
      thermalState: t.thermalState,
      missionId: t.missionId,
    });
  }

  return {
    heatmapPoints,
    analytics: {
      uniqueHunters,
      avgCaptureMinutes,
      claimConversionRate,
      totalHistoricalPings: allBrandPings.length,
      pushSubscribersCount,
    },
  };
}
