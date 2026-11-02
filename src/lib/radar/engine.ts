import crypto from "node:crypto";
import type {
  Brand,
  ClaimType,
  Hunter,
  Mission,
  MissionClaim,
  RadarClaimRequest,
  RadarClaimResponse,
  RadarPingRequest,
  RadarPingResponse,
  ThermalState,
} from "@/types/radar";
import {
  findBrandBySlug,
  findHunterById,
  findMissionById,
  getDb,
  mapPrismaClaim,
  mapPrismaMission,
  mapPrismaTelemetry,
  persistDb,
} from "@/lib/db/store";
import {
  getPrisma,
  isCloudDbEnabled,
  toPrismaThermal,
} from "@/lib/db/prisma";
import {
  calculateEffectiveCaptureRadius,
  calculateHaversineMeters,
  isValidLatLng,
} from "@/lib/radar/geo";

const ACTIVE_HUNTER_WINDOW_MS = 90_000;
const DANGER_ZONE_METERS = 65;

function computeThermalBracket(
  distanceMeters: number,
  zoneRadiusMeters: number,
  inVehicleMode: boolean
): { thermalState: ThermalState; heatIntensity: number } {
  if (distanceMeters > zoneRadiusMeters) {
    return { thermalState: "FUERA DE ZONA", heatIntensity: 6 };
  }
  if (distanceMeters > 650) {
    return { thermalState: "CONGELADO", heatIntensity: 24 };
  }
  if (distanceMeters > 160) {
    return { thermalState: "TIBIO", heatIntensity: 52 };
  }
  if (distanceMeters >= 30) {
    return { thermalState: "CALIENTE", heatIntensity: 78 };
  }

  // Player is < 30m from treasure
  if (inVehicleMode) {
    return { thermalState: "CALIENTE", heatIntensity: 76 };
  }

  return { thermalState: "QUEMANDO", heatIntensity: 98 };
}

function buildWhatsappRedeemUrl(
  brand: Brand,
  mission: Mission,
  alias: string,
  couponCode: string,
  claimType: ClaimType,
  prizeLabel: string
): string {
  const cleanPhone = brand.whatsapp.replace(/[^\d]/g, "");
  const header =
    claimType === "MAJOR_PRIZE"
      ? `🏆 ¡CAPTURÉ EL TESORO DE ${brand.name.toUpperCase()} EN RADAR QUEST!`
      : `🕹️ ¡ESCANÉE UN NODO DE ${brand.name.toUpperCase()} EN RADAR QUEST!`;

  const text = [
    header,
    `• Cazador: ${alias}`,
    `• Misión: ${mission.title} (${mission.city})`,
    `• Cupón Verificado: *${couponCode}*`,
    `• Beneficio: ${prizeLabel}`,
    `Quiero validar mi premio ahora.`,
  ].join("\n");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Processes a live hunter GPS ping (Cloud PostgreSQL Prisma + Local Fallback)
 * with Anti-Teleport (>500m / >130 km/h), Vehicle Mode (20-120+ km/h),
 * HunterPing persistence, Rival Danger Alerts, and In-App QR Scanner Gate.
 */
export async function processRadarPing(
  input: RadarPingRequest
): Promise<RadarPingResponse> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!isValidLatLng(input.lat, input.lng)) {
    throw new Error("Coordenadas GPS inválidas.");
  }

  const mission = await findMissionById(input.missionId);
  if (!mission) {
    throw new Error("Misión no encontrada.");
  }

  const distanceToSecret = calculateHaversineMeters(
    input.lat,
    input.lng,
    mission.secretLat,
    mission.secretLng
  );

  // Lookup previous telemetry state
  let prevTelemetry = null;
  if (isCloudDbEnabled()) {
    const row = await getPrisma().hunterMissionTelemetry.findUnique({
      where: {
        missionId_hunterId: {
          missionId: mission.id,
          hunterId: input.hunterId,
        },
      },
    });
    if (row) prevTelemetry = mapPrismaTelemetry(row);
  } else {
    prevTelemetry =
      getDb().telemetry.find(
        (t) => t.missionId === mission.id && t.hunterId === input.hunterId
      ) || null;
  }

  let speedKmh = 0;
  let isTeleportAnomaly = false;
  let inVehicleMode = false;
  let anomalyMessage: string | null = null;
  let vehicleMessage: string | null = null;

  if (prevTelemetry) {
    const prevMs = new Date(prevTelemetry.lastPingAt).getTime();
    const deltaMs = Math.max(1, nowMs - prevMs);
    const jumpMeters = calculateHaversineMeters(
      prevTelemetry.lastLat,
      prevTelemetry.lastLng,
      input.lat,
      input.lng
    );

    if (deltaMs <= 180_000) {
      const deltaHours = Math.max(deltaMs, 1200) / 3_600_000;
      const computedSpeed = jumpMeters / 1000 / deltaHours;
      speedKmh = jumpMeters < 18 ? Math.min(computedSpeed, 6) : computedSpeed;

      if (
        (jumpMeters > 500 && deltaMs <= 45_000) ||
        (jumpMeters >= 25 && speedKmh > 130)
      ) {
        isTeleportAnomaly = true;
        anomalyMessage =
          "TELEPORT_ANOMALY: Salto GPS imposible detectado (>130 km/h o >500m). Desactivá ubicaciones falsas para rastrear.";
      } else if (speedKmh >= 20 && speedKmh <= 130) {
        inVehicleMode = true;
        vehicleMessage = `MODO VEHÍCULO (${Math.round(
          speedKmh
        )} km/h): Radar limitado a CALIENTE. Estacioná y continuá a pie para habilitar ¡QUEMANDO! (<30m).`;
      }
    }
  }

  const { thermalState, heatIntensity } = isTeleportAnomaly
    ? { thermalState: "TELEPORT_ANOMALY" as ThermalState, heatIntensity: 0 }
    : computeThermalBracket(
        distanceToSecret,
        mission.zoneRadiusMeters,
        inVehicleMode
      );

  const isInsideZone = distanceToSecret <= mission.zoneRadiusMeters;
  const roundedDist = Number(distanceToSecret.toFixed(1));
  const roundedSpeed = Number(speedKmh.toFixed(1));
  const safeAcc = Math.max(1, input.accuracy || 10);

  let validHuntPings = 0;
  let activeHuntersCount = 1;
  let rivalCount = 0;

  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const prismaThermal = toPrismaThermal(thermalState);
    const windowCutoff = new Date(nowMs - ACTIVE_HUNTER_WINDOW_MS);

    // Ensure hunter FK exists in cloud DB
    await prisma.hunter.upsert({
      where: { id: input.hunterId },
      update: { alias: input.alias || "@cazador" },
      create: {
        id: input.hunterId,
        alias: input.alias || "@cazador",
        whatsapp: `+595000${input.hunterId.replace(/[^0-9a-z]/gi, "").slice(0, 7)}`,
        isAdult18: true,
      },
    });

    const [, updatedTelemetry, activeTelemetryRows] = await prisma.$transaction([
      prisma.hunterPing.create({
        data: {
          missionId: mission.id,
          hunterId: input.hunterId,
          alias: input.alias || "@cazador",
          lat: input.lat,
          lng: input.lng,
          accuracy: safeAcc,
          distanceMeters: roundedDist,
          speedKmh: roundedSpeed,
          inVehicleMode,
          isAnomaly: isTeleportAnomaly,
          thermalState: prismaThermal,
        },
      }),
      prisma.hunterMissionTelemetry.upsert({
        where: {
          missionId_hunterId: {
            missionId: mission.id,
            hunterId: input.hunterId,
          },
        },
        update: {
          alias: input.alias || "@cazador",
          lastLat: input.lat,
          lastLng: input.lng,
          lastAccuracy: safeAcc,
          lastDistanceMeters: roundedDist,
          speedKmh: roundedSpeed,
          inVehicleMode,
          thermalState: prismaThermal,
          pingCount: { increment: 1 },
          ...(isTeleportAnomaly
            ? { anomalyFlags: { increment: 1 } }
            : isInsideZone
            ? { validHuntPings: { increment: 1 } }
            : {}),
          lastPingAt: new Date(nowMs),
        },
        create: {
          missionId: mission.id,
          hunterId: input.hunterId,
          alias: input.alias || "@cazador",
          lastLat: input.lat,
          lastLng: input.lng,
          lastAccuracy: safeAcc,
          lastDistanceMeters: roundedDist,
          speedKmh: roundedSpeed,
          inVehicleMode,
          thermalState: prismaThermal,
          pingCount: 1,
          validHuntPings: !isTeleportAnomaly && isInsideZone ? 1 : 0,
          anomalyFlags: isTeleportAnomaly ? 1 : 0,
          firstPingAt: new Date(nowMs),
          lastPingAt: new Date(nowMs),
        },
      }),
      prisma.hunterMissionTelemetry.findMany({
        where: {
          missionId: mission.id,
          lastPingAt: { gte: windowCutoff },
        },
        select: {
          hunterId: true,
          thermalState: true,
          lastDistanceMeters: true,
        },
      }),
    ]);

    validHuntPings = updatedTelemetry.validHuntPings;
    activeHuntersCount = Math.max(1, activeTelemetryRows.length);
    rivalCount = activeTelemetryRows.filter(
      (r) =>
        r.hunterId !== input.hunterId &&
        r.thermalState !== "TELEPORT_ANOMALY" &&
        r.lastDistanceMeters <= DANGER_ZONE_METERS
    ).length;
  } else {
    const db = getDb();
    // Append individual HunterPing record (keep capped at last 500 pings in local JSON store)
    db.hunterPings.unshift({
      id: `png_${crypto.randomUUID().slice(0, 10)}`,
      missionId: mission.id,
      hunterId: input.hunterId,
      alias: input.alias || "@cazador",
      lat: input.lat,
      lng: input.lng,
      accuracy: safeAcc,
      distanceMeters: roundedDist,
      speedKmh: roundedSpeed,
      inVehicleMode,
      isAnomaly: isTeleportAnomaly,
      thermalState,
      createdAt: nowIso,
    });
    if (db.hunterPings.length > 500) {
      db.hunterPings.length = 500;
    }

    let telemetry = db.telemetry.find(
      (t) => t.missionId === mission.id && t.hunterId === input.hunterId
    );
    if (!telemetry) {
      telemetry = {
        id: `tel_${crypto.randomUUID().slice(0, 10)}`,
        missionId: mission.id,
        hunterId: input.hunterId,
        alias: input.alias || "@cazador",
        lastLat: input.lat,
        lastLng: input.lng,
        lastAccuracy: safeAcc,
        lastDistanceMeters: roundedDist,
        speedKmh: roundedSpeed,
        inVehicleMode,
        thermalState,
        pingCount: 1,
        validHuntPings: !isTeleportAnomaly && isInsideZone ? 1 : 0,
        anomalyFlags: isTeleportAnomaly ? 1 : 0,
        firstPingAt: nowIso,
        lastPingAt: nowIso,
      };
      db.telemetry.push(telemetry);
    } else {
      telemetry.alias = input.alias || telemetry.alias;
      telemetry.lastLat = input.lat;
      telemetry.lastLng = input.lng;
      telemetry.lastAccuracy = safeAcc;
      telemetry.lastDistanceMeters = roundedDist;
      telemetry.speedKmh = roundedSpeed;
      telemetry.inVehicleMode = inVehicleMode;
      telemetry.thermalState = thermalState;
      telemetry.pingCount += 1;
      if (isTeleportAnomaly) {
        telemetry.anomalyFlags += 1;
      } else if (isInsideZone) {
        telemetry.validHuntPings += 1;
      }
      telemetry.lastPingAt = nowIso;
    }

    persistDb(db);
    validHuntPings = telemetry.validHuntPings;

    const activeMissionHunters = db.telemetry.filter(
      (t) =>
        t.missionId === mission.id &&
        nowMs - new Date(t.lastPingAt).getTime() <= ACTIVE_HUNTER_WINDOW_MS
    );
    activeHuntersCount = Math.max(1, activeMissionHunters.length);
    rivalCount = activeMissionHunters.filter(
      (t) =>
        t.hunterId !== input.hunterId &&
        t.thermalState !== "TELEPORT_ANOMALY" &&
        t.lastDistanceMeters <= DANGER_ZONE_METERS
    ).length;
  }

  const dangerAlert =
    rivalCount > 0 && mission.status === "ACTIVE"
      ? {
          active: true,
          rivalCount,
          message:
            rivalCount === 1
              ? "¡ALERTA DE PELIGRO! Otro cazador entró en ZONA DE CAPTURA."
              : `¡ALERTA CRÍTICA! ${rivalCount} cazadores rivales están en ZONA DE CAPTURA.`,
        }
      : {
          active: false,
          rivalCount: 0,
          message: null,
        };

  // Strict Phase 2 rule: In-app scanner unlocked ONLY in QUEMANDO (<30m) and walking (<20 km/h)
  const canOpenQrScanner =
    thermalState === "QUEMANDO" && !inVehicleMode && roundedSpeed < 20;

  return {
    ok: true,
    thermalState,
    heatIntensity,
    inVehicleMode,
    speedKmh: roundedSpeed,
    vehicleMessage,
    anomalyMessage,
    activeHuntersCount,
    dangerAlert,
    proofOfHuntProgress: {
      currentValidPings: validHuntPings,
      requiredPings: mission.minPingsForMajorPrize,
      ready: validHuntPings >= mission.minPingsForMajorPrize,
    },
    canOpenQrScanner,
    missionStatus: mission.status,
    winnerAlias: mission.winnerAlias,
    serverTimestamp: nowIso,
  };
}

/**
 * Atomic Double Capture Validation & Anti-Snooper ("Proof of Hunt") Claim Engine.
 * Uses PostgreSQL atomic conditional update inside $transaction when DATABASE_URL is active.
 */
export async function processRadarClaim(
  input: RadarClaimRequest,
  verifiedHunter: Hunter | null
): Promise<RadarClaimResponse> {
  const code = input.tokenOrNodeCode.trim();
  const brand = await findBrandBySlug(input.brandSlug);

  if (!brand) {
    return {
      ok: false,
      errorCode: "INVALID_TOKEN",
      message: "Marca o cliente no válido en Radar Quest.",
    };
  }

  // Resolve Mission by Token or Reusable Node
  let mission: Mission | null = null;
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const direct = await prisma.mission.findFirst({
      where: {
        brandId: brand.id,
        qrToken: { equals: code, mode: "insensitive" },
      },
    });
    if (direct) {
      mission = mapPrismaMission(direct);
    } else {
      const node = await prisma.reusableQrNode.findFirst({
        where: {
          brandId: brand.id,
          active: true,
          code: { equals: code, mode: "insensitive" },
        },
      });
      if (node?.assignedMissionId) {
        const linked = await prisma.mission.findFirst({
          where: { id: node.assignedMissionId, brandId: brand.id },
        });
        if (linked) mission = mapPrismaMission(linked);
      }
    }
  } else {
    const db = getDb();
    mission =
      db.missions.find(
        (m) =>
          m.brandId === brand.id &&
          m.qrToken.toUpperCase() === code.toUpperCase()
      ) || null;

    if (!mission) {
      const node = db.reusableNodes.find(
        (n) =>
          n.brandId === brand.id &&
          n.active &&
          n.code.toUpperCase() === code.toUpperCase()
      );
      if (node?.assignedMissionId) {
        mission =
          db.missions.find(
            (m) => m.id === node.assignedMissionId && m.brandId === brand.id
          ) || null;
      }
    }
  }

  if (!mission) {
    return {
      ok: false,
      errorCode: "INVALID_TOKEN",
      message:
        "Código QR inválido o nodo reutilizable sin misión asignada para esta marca.",
    };
  }

  if (mission.status === "DRAFT" || mission.status === "PAUSED") {
    return {
      ok: false,
      errorCode: "MISSION_INACTIVE",
      message:
        "Esta misión aún no está activa o fue pausada por el organizador.",
    };
  }

  const hunter =
    verifiedHunter ||
    (input.hunterId ? await findHunterById(input.hunterId) : null);

  if (!hunter) {
    return {
      ok: false,
      errorCode: "HUNTER_NOT_REGISTERED",
      message:
        "Completá el registro rápido de 3 segundos (Alias + WhatsApp) antes de reclamar el tesoro.",
    };
  }

  if (brand.requireAdult18 && !hunter.isAdult18) {
    return {
      ok: false,
      errorCode: "AGE_RESTRICTION",
      message: `Esta misión de ${brand.name} es exclusiva para mayores de 18 años (+18).`,
    };
  }

  if (!isValidLatLng(input.lat, input.lng)) {
    return {
      ok: false,
      errorCode: "OUT_OF_CAPTURE_RADIUS",
      message:
        "Necesitamos tu ubicación GPS activa para validar el escaneo físico.",
    };
  }

  // Validate GPS Distance vs Adaptive Capture Radius (35m base, STRICT 65m ceiling)
  const distanceMeters = calculateHaversineMeters(
    input.lat,
    input.lng,
    mission.secretLat,
    mission.secretLng
  );
  const effectiveRadius = calculateEffectiveCaptureRadius(
    mission.captureRadiusMeters,
    input.accuracy
  );

  if (distanceMeters > effectiveRadius) {
    return {
      ok: false,
      errorCode: "OUT_OF_CAPTURE_RADIUS",
      message: `Estás fuera del radio físico del QR (${Math.round(
        distanceMeters
      )}m > ${Math.round(
        effectiveRadius
      )}m máx permitido). Acercate al cartel físico con el GPS encendido.`,
    };
  }

  const prefix = brand.slug
    .split("-")
    .map((w) => w[0]?.toUpperCase() || "R")
    .join("")
    .slice(0, 4);
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();

  // ==========================================================================
  // CLOUD POSTGRESQL ATOMIC TRANSACTION PATH
  // ==========================================================================
  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const existing = await tx.claim.findFirst({
        where: { missionId: mission.id, hunterId: hunter.id },
      });
      if (existing) {
        const mapped = mapPrismaClaim(existing);
        return {
          ok: true,
          message:
            mapped.claimType === "MAJOR_PRIZE"
              ? "¡Ya sos el ganador oficial de este Tesoro! Acá tenés tu cupón verificado."
              : "Ya registraste tu escaneo en este punto. Acá tenés tu Cupón Explorador Curioso.",
          claim: mapped,
          missionTitle: mission.title,
          brandName: brand.name,
        };
      }

      const telemetry = await tx.hunterMissionTelemetry.findUnique({
        where: {
          missionId_hunterId: {
            missionId: mission.id,
            hunterId: hunter.id,
          },
        },
      });

      if (telemetry?.thermalState === "TELEPORT_ANOMALY") {
        return {
          ok: false,
          errorCode: "TELEPORT_LOCKED" as const,
          message:
            "Captura bloqueada por anomalía de velocidad/GPS (Anti-Spoofing). Caminá normalmente con el radar activo e intentá de nuevo.",
        };
      }

      const validPings = telemetry?.validHuntPings ?? 0;
      const proofOfHuntPassed = validPings >= mission.minPingsForMajorPrize;

      let claimType: ClaimType;
      let couponCode: string;
      let prizeLabel: string;
      let userMessage: string;

      if (proofOfHuntPassed) {
        const tryCoupon = `${prefix}-WIN-${randomSuffix}`;
        // Atomic row-level lock: succeeds ONLY for the exact first hunter while status === 'ACTIVE'
        const won = await tx.mission.updateMany({
          where: { id: mission.id, status: "ACTIVE" },
          data: {
            status: "CAPTURED",
            winnerHunterId: hunter.id,
            winnerAlias: hunter.alias,
            winnerClaimCode: tryCoupon,
            capturedAt: new Date(),
          },
        });

        if (won.count === 1) {
          claimType = "MAJOR_PRIZE";
          couponCode = tryCoupon;
          prizeLabel = mission.prizeTitle;
          userMessage = `¡TESORO CAPTURADO! Fuiste el primer cazador verificado en encontrar "${mission.title}".`;
        } else {
          const freshMsn = await tx.mission.findUnique({
            where: { id: mission.id },
            select: { winnerAlias: true },
          });
          claimType = "CONSOLATION_LATE";
          couponCode = `${prefix}-LATE-${randomSuffix}`;
          prizeLabel = `${mission.consolationTitle} (Explorador Curioso)`;
          userMessage = `¡Casi! El Premio Mayor ya fue capturado por ${
            freshMsn?.winnerAlias || "otro cazador"
          }, pero por llegar hasta el punto ganaste un Cupón de Consuelo oficial.`;
        }
      } else {
        const freshMsn = await tx.mission.findUnique({
          where: { id: mission.id },
          select: { status: true, winnerAlias: true },
        });

        if (freshMsn?.status === "ACTIVE") {
          claimType = "CONSOLATION_CURIOUS";
          couponCode = `${prefix}-EXP-${randomSuffix}`;
          prizeLabel = `${mission.consolationTitle} (Explorador Curioso)`;
          userMessage = `¡MODO EXPLORADOR CURIOSO! Escaneaste el QR sin historial previo de caza en el radar (${validPings}/${mission.minPingsForMajorPrize} pulsos). ¡El Premio Mayor sigue oculto para los cazadores en ruta, pero ganaste este Cupón de Consuelo!`;
        } else {
          claimType = "CONSOLATION_LATE";
          couponCode = `${prefix}-LATE-${randomSuffix}`;
          prizeLabel = `${mission.consolationTitle} (Explorador Curioso)`;
          userMessage = `El Premio Mayor ya fue capturado por ${
            freshMsn?.winnerAlias || "otro cazador"
          }, pero ganaste un Cupón de Consuelo oficial.`;
        }
      }

      await tx.brandLead.upsert({
        where: {
          brandId_whatsapp: {
            brandId: brand.id,
            whatsapp: hunter.whatsapp,
          },
        },
        update: { alias: hunter.alias },
        create: {
          brandId: brand.id,
          hunterId: hunter.id,
          alias: hunter.alias,
          whatsapp: hunter.whatsapp,
          isAdult18: hunter.isAdult18,
          sourceMissionId: mission.id,
          city: mission.city,
        },
      });

      const whatsappRedeemUrl = buildWhatsappRedeemUrl(
        brand,
        mission,
        hunter.alias,
        couponCode,
        claimType,
        prizeLabel
      );

      const createdClaim = await tx.claim.create({
        data: {
          missionId: mission.id,
          brandId: brand.id,
          hunterId: hunter.id,
          alias: hunter.alias,
          whatsapp: hunter.whatsapp,
          claimType,
          couponCode,
          prizeLabel,
          distanceAtClaimMeters: Number(distanceMeters.toFixed(1)),
          accuracyAtClaimMeters: Number((input.accuracy || 10).toFixed(1)),
          effectiveRadiusMeters: effectiveRadius,
          proofOfHuntPassed,
          whatsappRedeemUrl,
        },
      });

      return {
        ok: true,
        message: userMessage,
        claim: mapPrismaClaim(createdClaim),
        missionTitle: mission.title,
        brandName: brand.name,
      };
    });
  }

  // ==========================================================================
  // LOCAL STORE FALLBACK PATH
  // ==========================================================================
  const db = getDb();
  const dbMission = db.missions.find((m) => m.id === mission.id)!;

  const existingClaim = db.claims.find(
    (c) => c.missionId === dbMission.id && c.hunterId === hunter.id
  );
  if (existingClaim) {
    return {
      ok: true,
      message:
        existingClaim.claimType === "MAJOR_PRIZE"
          ? "¡Ya sos el ganador oficial de este Tesoro! Acá tenés tu cupón verificado."
          : "Ya registraste tu escaneo en este punto. Acá tenés tu Cupón Explorador Curioso.",
      claim: existingClaim,
      missionTitle: dbMission.title,
      brandName: brand.name,
    };
  }

  const telemetry = db.telemetry.find(
    (t) => t.missionId === dbMission.id && t.hunterId === hunter.id
  );

  if (telemetry && telemetry.thermalState === "TELEPORT_ANOMALY") {
    return {
      ok: false,
      errorCode: "TELEPORT_LOCKED",
      message:
        "Captura bloqueada por anomalía de velocidad/GPS (Anti-Spoofing). Caminá normalmente con el radar activo e intentá de nuevo.",
    };
  }

  const validPings = telemetry ? telemetry.validHuntPings : 0;
  const proofOfHuntPassed = validPings >= dbMission.minPingsForMajorPrize;

  let claimType: ClaimType;
  let couponCode: string;
  let prizeLabel: string;
  let userMessage: string;

  if (dbMission.status === "ACTIVE" && proofOfHuntPassed) {
    claimType = "MAJOR_PRIZE";
    couponCode = `${prefix}-WIN-${randomSuffix}`;
    prizeLabel = dbMission.prizeTitle;
    userMessage = `¡TESORO CAPTURADO! Fuiste el primer cazador verificado en encontrar "${dbMission.title}".`;

    dbMission.status = "CAPTURED";
    dbMission.winnerHunterId = hunter.id;
    dbMission.winnerAlias = hunter.alias;
    dbMission.winnerClaimCode = couponCode;
    dbMission.capturedAt = new Date().toISOString();
    dbMission.updatedAt = dbMission.capturedAt;
  } else if (dbMission.status === "ACTIVE" && !proofOfHuntPassed) {
    claimType = "CONSOLATION_CURIOUS";
    couponCode = `${prefix}-EXP-${randomSuffix}`;
    prizeLabel = `${dbMission.consolationTitle} (Explorador Curioso)`;
    userMessage = `¡MODO EXPLORADOR CURIOSO! Escaneaste el QR sin historial previo de caza en el radar (${validPings}/${dbMission.minPingsForMajorPrize} pulsos). ¡El Premio Mayor sigue oculto para los cazadores en ruta, pero ganaste este Cupón de Consuelo!`;
  } else {
    claimType = "CONSOLATION_LATE";
    couponCode = `${prefix}-LATE-${randomSuffix}`;
    prizeLabel = `${dbMission.consolationTitle} (Explorador Curioso)`;
    userMessage = `¡Casi! El Premio Mayor ya fue capturado por ${
      dbMission.winnerAlias || "otro cazador"
    }, pero por llegar hasta el punto ganaste un Cupón de Consuelo oficial.`;
  }

  const hasLead = db.leads.some(
    (l) => l.brandId === brand.id && l.whatsapp === hunter.whatsapp
  );
  if (!hasLead) {
    db.leads.push({
      id: `lead_${crypto.randomUUID().slice(0, 10)}`,
      brandId: brand.id,
      hunterId: hunter.id,
      alias: hunter.alias,
      whatsapp: hunter.whatsapp,
      isAdult18: hunter.isAdult18,
      sourceMissionId: dbMission.id,
      city: dbMission.city,
      createdAt: new Date().toISOString(),
    });
  }

  const whatsappRedeemUrl = buildWhatsappRedeemUrl(
    brand,
    dbMission,
    hunter.alias,
    couponCode,
    claimType,
    prizeLabel
  );

  const claim: MissionClaim = {
    id: `clm_${crypto.randomUUID().slice(0, 10)}`,
    missionId: dbMission.id,
    brandId: brand.id,
    hunterId: hunter.id,
    alias: hunter.alias,
    whatsapp: hunter.whatsapp,
    claimType,
    couponCode,
    prizeLabel,
    distanceAtClaimMeters: Number(distanceMeters.toFixed(1)),
    accuracyAtClaimMeters: Number((input.accuracy || 10).toFixed(1)),
    effectiveRadiusMeters: effectiveRadius,
    proofOfHuntPassed,
    whatsappRedeemUrl,
    claimedAt: new Date().toISOString(),
  };

  db.claims.unshift(claim);
  persistDb(db);

  return {
    ok: true,
    message: userMessage,
    claim,
    missionTitle: dbMission.title,
    brandName: brand.name,
  };
}
