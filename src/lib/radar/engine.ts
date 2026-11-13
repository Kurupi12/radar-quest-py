import crypto from "node:crypto";
import type {
  Brand,
  ClaimType,
  ClimaxLevel,
  Hunter,
  Mission,
  MissionClaim,
  RadarClaimRequest,
  RadarClaimResponse,
  RadarPingRequest,
  RadarPingResponse,
  RouteBonusBeacon,
  ThermalState,
  TriangulationResponse,
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
  calculateBearingDegrees,
  calculateEffectiveCaptureRadius,
  calculateHaversineMeters,
  computeBearingSector8,
  computeMissionBonusBeacons,
  isValidLatLng,
} from "@/lib/radar/geo";
import {
  evaluateTacticalVectorAssistance,
  type KinematicPingSample,
} from "@/lib/radar/tacticalVectorAssistance";

const ACTIVE_HUNTER_WINDOW_MS = 90_000;
const DANGER_ZONE_METERS = 65;
const TACTICAL_KINEMATIC_WINDOW_MS = 30_000;
const BONUS_BEACON_CAPTURE_RADIUS_METERS = 45;
const TRIANGULATION_COOLDOWN_MS = 60_000;
const TRIANGULATION_SWEEP_MS = 4_000;
const TRIANGULATION_MIN_DISTANCE_METERS = 45;

const globalForEngine = globalThis as unknown as {
  __rqTriangulationCooldown?: Map<string, number>;
};

function getTriangulationCooldownMap(): Map<string, number> {
  if (!globalForEngine.__rqTriangulationCooldown) {
    globalForEngine.__rqTriangulationCooldown = new Map();
  }
  return globalForEngine.__rqTriangulationCooldown;
}

function applyTriangulationCooldownBoost(
  missionId: string,
  hunterId: string,
  boostMs: number
): void {
  const map = getTriangulationCooldownMap();
  const key = `${missionId}:${hunterId}`;
  const currentNext = map.get(key);
  if (typeof currentNext === "number") {
    map.set(key, Math.max(Date.now(), currentNext - boostMs));
  }
}

function computeClimaxLevel(
  thermalState: ThermalState,
  distanceToSecretMeters: number
): ClimaxLevel | null {
  if (thermalState !== "QUEMANDO") return null;
  if (distanceToSecretMeters < 10) return 3;
  if (distanceToSecretMeters < 20) return 2;
  return 1;
}

function computeThermalBracket(
  distanceMeters: number,
  zoneRadiusMeters: number,
  inVehicleMode: boolean,
  speedKmh = 0
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

  // Player is < 30m from treasure: allow pedestrian GPS jitter up to 35 km/h
  if (inVehicleMode && speedKmh >= 35) {
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
  prizeLabel: string,
  claimMethod?: "QR_SCAN" | "PRESENTIAL_GPS"
): string {
  const cleanPhone = brand.whatsapp.replace(/[^\d]/g, "");
  const isPresential = claimMethod === "PRESENTIAL_GPS";
  const header =
    claimType === "MAJOR_PRIZE"
      ? isPresential
        ? `🏆 ¡LLEGUÉ AL PUNTO DE ${brand.name.toUpperCase()} (ENCUENTRO MARKETING)!`
        : `🏆 ¡CAPTURÉ EL TESORO DE ${brand.name.toUpperCase()} EN RADAR QUEST!`
      : `🕹️ ¡ESCANÉE UN NODO DE ${brand.name.toUpperCase()} EN RADAR QUEST!`;

  const text = [
    header,
    `• Cazador: ${alias}`,
    `• Misión: ${mission.title} (${mission.city})`,
    `• Cupón Verificado: *${couponCode}*`,
    `• Beneficio: ${prizeLabel}`,
    isPresential
      ? `¡Estoy acá en el lugar del drop con el equipo de marketing para la entrega oficial y el video!`
      : `Quiero validar mi premio ahora.`,
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

  if (mission.status === "PAUSED" || mission.status === "DRAFT") {
    return {
      ok: true,
      thermalState: "FUERA DE ZONA",
      heatIntensity: 0,
      climaxLevel: null,
      inVehicleMode: false,
      speedKmh: 0,
      vehicleMessage: null,
      anomalyMessage: null,
      activeHuntersCount: 1,
      dangerAlert: {
        active: false,
        rivalCount: 0,
        message: null,
      },
      tacticalHint: {
        message:
          mission.status === "PAUSED"
            ? "MISIÓN EN PAUSA: SELECCIONA UNA MISIÓN ACTIVA PARA RASTREAR"
            : "MISIÓN EN BORRADOR: ESPERANDO ACTIVACIÓN DE MARCA",
        trend: "NEUTRAL",
        deltaMeters: 0,
      },
      tacticalStateSnapshot: input.prevTacticalState || undefined,
      proofOfHuntProgress: {
        currentValidPings: 0,
        requiredPings: mission.minPingsForMajorPrize,
        ready: false,
      },
      bonusNodes: [],
      newlyCollectedBonusNodeId: null,
      triangulationCooldownBoostMs: 0,
      canOpenQrScanner: false,
      canClaimPresential: false,
      validationMode: mission.validationMode || "HYBRID",
      missionStatus: mission.status,
      winnerAlias: mission.winnerAlias,
      serverTimestamp: nowIso,
    };
  }

  const distanceToSecret = calculateHaversineMeters(
    input.lat,
    input.lng,
    mission.secretLat,
    mission.secretLng
  );

  // Lookup previous telemetry state
  let prevTelemetry = null;
  let useCloud = isCloudDbEnabled();
  if (useCloud) {
    try {
      const row = await getPrisma().hunterMissionTelemetry.findUnique({
        where: {
          missionId_hunterId: {
            missionId: mission.id,
            hunterId: input.hunterId,
          },
        },
      });
      if (row) prevTelemetry = mapPrismaTelemetry(row);
    } catch (err) {
      console.warn("[RadarEngine] Cloud DB telemetry lookup failed, disabling cloud for this ping:", err);
      useCloud = false;
    }
  }

  if (!useCloud) {
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

      const vehicleSpeedThresholdKmh = distanceToSecret < 30 ? 35 : 20;

      if (
        (jumpMeters > 500 && deltaMs <= 45_000) ||
        (jumpMeters >= 25 && speedKmh > 130)
      ) {
        isTeleportAnomaly = true;
        anomalyMessage =
          "TELEPORT_ANOMALY: Salto GPS imposible detectado (>130 km/h o >500m). Desactivá ubicaciones falsas para rastrear.";
      } else if (speedKmh >= vehicleSpeedThresholdKmh && speedKmh <= 130) {
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
        inVehicleMode,
        speedKmh
      );

  const isInsideZone = distanceToSecret <= mission.zoneRadiusMeters;
  const roundedDist = Number(distanceToSecret.toFixed(1));
  const roundedSpeed = Number(speedKmh.toFixed(1));
  const safeAcc = Math.max(1, input.accuracy || 10);
  const climaxLevel = computeClimaxLevel(thermalState, distanceToSecret);

  const rawBeacons = computeMissionBonusBeacons(
    mission.id,
    mission.publicCenterLat,
    mission.publicCenterLng,
    mission.zoneRadiusMeters
  );
  let bonusNodes: RouteBonusBeacon[] = rawBeacons.map((b) => ({
    ...b,
    collected: false,
  }));
  let newlyCollectedBonusNodeId: string | null = null;
  let triangulationCooldownBoostMs = 0;

  let validHuntPings = 0;
  let activeHuntersCount = 1;
  let rivalCount = 0;
  let kinematicSamples: KinematicPingSample[] = [];

  const evaluateBeaconsAgainstHistory = (
    priorWalkingCoords: Array<{ lat: number; lng: number }>
  ): number => {
    if (mission.status !== "ACTIVE") {
      bonusNodes = [];
      return 0;
    }

    const collectedIds = new Set<string>();
    for (const b of rawBeacons) {
      const hitBefore = priorWalkingCoords.some(
        (p) =>
          calculateHaversineMeters(p.lat, p.lng, b.lat, b.lng) <=
          BONUS_BEACON_CAPTURE_RADIUS_METERS
      );
      if (hitBefore) {
        collectedIds.add(b.id);
      } else if (
        !newlyCollectedBonusNodeId &&
        !isTeleportAnomaly &&
        !inVehicleMode &&
        isInsideZone &&
        calculateHaversineMeters(input.lat, input.lng, b.lat, b.lng) <=
          BONUS_BEACON_CAPTURE_RADIUS_METERS
      ) {
        collectedIds.add(b.id);
        newlyCollectedBonusNodeId = b.id;
        triangulationCooldownBoostMs = 15_000;
        applyTriangulationCooldownBoost(mission.id, input.hunterId, 15_000);
      }
    }
    bonusNodes = rawBeacons.map((b) => ({
      ...b,
      collected: collectedIds.has(b.id),
    }));

    if (isTeleportAnomaly) return 0;
    if (newlyCollectedBonusNodeId) return 2;
    return isInsideZone ? 1 : 0;
  };

  let cloudProcessed = false;
  if (useCloud) {
    try {
      const prisma = getPrisma();
      const prismaThermal = toPrismaThermal(thermalState);
      const windowCutoff = new Date(nowMs - ACTIVE_HUNTER_WINDOW_MS);
      const kinematicCutoff = new Date(nowMs - TACTICAL_KINEMATIC_WINDOW_MS);

      const priorWalkingPings = await prisma.hunterPing.findMany({
        where: {
          missionId: mission.id,
          hunterId: input.hunterId,
          isAnomaly: false,
          inVehicleMode: false,
        },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: { lat: true, lng: true },
      });

      const validPingIncrement = evaluateBeaconsAgainstHistory(priorWalkingPings);

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

      const [, updatedTelemetry, activeTelemetryRows, recentPingRows] =
        await prisma.$transaction([
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
                : validPingIncrement > 0
                ? { validHuntPings: { increment: validPingIncrement } }
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
              validHuntPings: validPingIncrement,
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
          prisma.hunterPing.findMany({
            where: {
              missionId: mission.id,
              hunterId: input.hunterId,
              createdAt: { gte: kinematicCutoff },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              lat: true,
              lng: true,
              distanceMeters: true,
              speedKmh: true,
              inVehicleMode: true,
              isAnomaly: true,
              createdAt: true,
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

      kinematicSamples = recentPingRows
        .slice()
        .reverse()
        .map((p) => ({
          lat: p.lat,
          lng: p.lng,
          distanceMeters: p.distanceMeters,
          speedKmh: p.speedKmh,
          inVehicleMode: p.inVehicleMode,
          isAnomaly: p.isAnomaly,
          timestampMs: p.createdAt.getTime(),
        }));
      cloudProcessed = true;
    } catch (err) {
      console.warn("[RadarEngine] Cloud DB ping persist failed, falling back to local DB:", err);
      cloudProcessed = false;
    }
  }

  if (!cloudProcessed) {
    const db = getDb();
    const priorWalkingPings = db.hunterPings.filter(
      (p) =>
        p.missionId === mission.id &&
        p.hunterId === input.hunterId &&
        !p.isAnomaly &&
        !p.inVehicleMode
    );
    const validPingIncrement = evaluateBeaconsAgainstHistory(priorWalkingPings);

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
        validHuntPings: validPingIncrement,
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
      } else if (validPingIncrement > 0) {
        telemetry.validHuntPings += validPingIncrement;
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

    kinematicSamples = db.hunterPings
      .filter(
        (p) =>
          p.missionId === mission.id &&
          p.hunterId === input.hunterId &&
          nowMs - new Date(p.createdAt).getTime() <=
            TACTICAL_KINEMATIC_WINDOW_MS
      )
      .slice(0, 10)
      .reverse()
      .map((p) => ({
        lat: p.lat,
        lng: p.lng,
        distanceMeters: p.distanceMeters,
        speedKmh: p.speedKmh,
        inVehicleMode: p.inVehicleMode,
        isAnomaly: p.isAnomaly,
        timestampMs: new Date(p.createdAt).getTime(),
      }));
  }

  // Ensure current ping is at the tail of kinematicSamples and backfill prevTelemetry if sparse
  const currentSample: KinematicPingSample = {
    lat: input.lat,
    lng: input.lng,
    distanceMeters: roundedDist,
    speedKmh: roundedSpeed,
    inVehicleMode,
    isAnomaly: isTeleportAnomaly,
    timestampMs: nowMs,
  };

  if (
    kinematicSamples.length === 0 ||
    Math.abs(
      kinematicSamples[kinematicSamples.length - 1].timestampMs - nowMs
    ) > 1500
  ) {
    kinematicSamples.push(currentSample);
  }

  if (kinematicSamples.length < 2 && prevTelemetry) {
    const prevMs = new Date(prevTelemetry.lastPingAt).getTime();
    if (prevMs < nowMs && nowMs - prevMs <= 45_000) {
      kinematicSamples.unshift({
        lat: prevTelemetry.lastLat,
        lng: prevTelemetry.lastLng,
        distanceMeters: prevTelemetry.lastDistanceMeters,
        speedKmh: prevTelemetry.speedKmh,
        inVehicleMode: prevTelemetry.inVehicleMode,
        isAnomaly: prevTelemetry.thermalState === "TELEPORT_ANOMALY",
        timestampMs: prevMs,
      });
    }
  }

  const { tacticalHint, snapshot: tacticalStateSnapshot } =
    evaluateTacticalVectorAssistance({
      missionId: mission.id,
      hunterId: input.hunterId,
      nowMs,
      currentDistanceMeters: roundedDist,
      currentSpeedKmh: roundedSpeed,
      inVehicleMode,
      isTeleportAnomaly,
      thermalState,
      recentSamples: kinematicSamples,
      clientPrevState: input.prevTacticalState || null,
    });

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

  // Strict Phase 2 rule: In-app scanner & Presential claim unlocked in QUEMANDO (<30m)
  // When inside <30m, allow pedestrian tolerance (up to 35 km/h to absorb mobile GPS jitter/spikes)
  const validationMode = mission.validationMode || "HYBRID";
  const isCloseEnough =
    thermalState === "QUEMANDO" && (!inVehicleMode || roundedSpeed < 35);

  const canOpenQrScanner =
    isCloseEnough &&
    (mission.status === "ACTIVE" || mission.status === "CAPTURED") &&
    (validationMode === "QR_SCAN" || validationMode === "HYBRID");
  const canClaimPresential =
    isCloseEnough &&
    mission.status === "ACTIVE" &&
    (validationMode === "PRESENTIAL_GPS" || validationMode === "HYBRID");

  return {
    ok: true,
    thermalState,
    heatIntensity,
    climaxLevel,
    inVehicleMode,
    speedKmh: roundedSpeed,
    vehicleMessage,
    anomalyMessage,
    activeHuntersCount,
    dangerAlert,
    tacticalHint,
    tacticalStateSnapshot,
    proofOfHuntProgress: {
      currentValidPings: validHuntPings,
      requiredPings: mission.minPingsForMajorPrize,
      ready: validHuntPings >= mission.minPingsForMajorPrize,
    },
    bonusNodes,
    newlyCollectedBonusNodeId,
    triangulationCooldownBoostMs,
    canOpenQrScanner,
    canClaimPresential,
    validationMode,
    missionStatus: mission.status,
    winnerAlias: mission.winnerAlias,
    serverTimestamp: nowIso,
  };
}

/**
 * Active Triangulation Pulse (server-enforced 60s cooldown):
 * Returns ONLY a coarse 45-degree sector sweep toward the target when distance >= 45m
 * inside the mission zone. Never exposes raw coordinates or distance in meters.
 */
export async function processRadarTriangulation(input: {
  missionId: string;
  hunterId: string;
  lat: number;
  lng: number;
}): Promise<TriangulationResponse> {
  const nowMs = Date.now();
  if (!isValidLatLng(input.lat, input.lng)) {
    return {
      ok: false,
      message: "Coordenadas GPS inválidas para triangular.",
    };
  }

  const cooldownMap = getTriangulationCooldownMap();
  const key = `${input.missionId}:${input.hunterId}`;
  const nextAvailableAtMs = cooldownMap.get(key) || 0;
  if (nowMs < nextAvailableAtMs) {
    const remainingSec = Math.max(1, Math.ceil((nextAvailableAtMs - nowMs) / 1000));
    return {
      ok: false,
      cooldownRemainingSeconds: remainingSec,
      nextAvailableAtMs,
      message: `Recargando pulso de triangulación (${remainingSec}s).`,
    };
  }

  const mission = await findMissionById(input.missionId);
  if (!mission) {
    return { ok: false, message: "Misión no encontrada." };
  }
  if (mission.status !== "ACTIVE") {
    return { ok: false, message: "La misión ya no está activa." };
  }

  const distMeters = calculateHaversineMeters(
    input.lat,
    input.lng,
    mission.secretLat,
    mission.secretLng
  );

  if (distMeters > mission.zoneRadiusMeters) {
    return {
      ok: false,
      message: "Acercate a la zona del drop antes de emitir el pulso de triangulación.",
    };
  }

  if (distMeters < TRIANGULATION_MIN_DISTANCE_METERS) {
    return {
      ok: false,
      message:
        "Ya estás a corta distancia (<45m): guiáte por las ondas térmicas ¡CALIENTE!/¡QUEMANDO!.",
    };
  }

  const rawBearing = calculateBearingDegrees(
    input.lat,
    input.lng,
    mission.secretLat,
    mission.secretLng
  );
  const sector = computeBearingSector8(rawBearing);
  const newNextAvailableAtMs = nowMs + TRIANGULATION_COOLDOWN_MS;
  cooldownMap.set(key, newNextAvailableAtMs);

  return {
    ok: true,
    sectorCode: sector.sectorCode,
    sectorLabel: sector.sectorLabel,
    centerBearingDeg: sector.centerBearingDeg,
    sweepArcDeg: 45,
    cooldownRemainingSeconds: Math.round(TRIANGULATION_COOLDOWN_MS / 1000),
    nextAvailableAtMs: newNextAvailableAtMs,
    expiresAtMs: nowMs + TRIANGULATION_SWEEP_MS,
    message: `PULSO DE TRIANGULACIÓN: señal intensa detectada hacia el sector ${sector.sectorLabel.toUpperCase()} (${sector.sectorCode}).`,
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

  const isPresential =
    input.claimMethod === "PRESENTIAL_GPS" ||
    code.toUpperCase() === "PRESENTIAL_GPS" ||
    code.startsWith("PRESENTIAL_");

  // Resolve Mission by Token, Reusable Node, or Presential GPS check-in
  let mission: Mission | null = null;
  if (isPresential) {
    if (input.missionId) {
      mission = await findMissionById(input.missionId);
    }
    if (!mission && isCloudDbEnabled()) {
      const active = await getPrisma().mission.findFirst({
        where: { brandId: brand.id, status: "ACTIVE" },
      });
      if (active) mission = mapPrismaMission(active);
    } else if (!mission) {
      mission =
        getDb().missions.find(
          (m) => m.brandId === brand.id && m.status === "ACTIVE"
        ) || null;
    }

    if (mission && mission.validationMode === "QR_SCAN") {
      return {
        ok: false,
        errorCode: "INVALID_TOKEN",
        message:
          "Esta misión requiere escanear el cartel o código QR físico con la cámara.",
      };
    }
  } else if (isCloudDbEnabled()) {
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
          userMessage = isPresential
            ? `¡LLEGASTE PRIMERO! Fuiste el primer cazador en llegar a "${mission.title}". ¡Acercate al equipo de marketing de ${brand.name} para recibir tu premio y filmar la entrega oficial!`
            : `¡TESORO CAPTURADO! Fuiste el primer cazador verificado en encontrar "${mission.title}".`;
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
        prizeLabel,
        input.claimMethod
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

      const mappedClaim = mapPrismaClaim(createdClaim);
      mappedClaim.claimMethod = input.claimMethod || "QR_SCAN";

      return {
        ok: true,
        message: userMessage,
        claim: mappedClaim,
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
    userMessage = isPresential
      ? `¡LLEGASTE PRIMERO! Fuiste el primer cazador en llegar a "${dbMission.title}". ¡Acercate al equipo de marketing de ${brand.name} para recibir tu premio y filmar la entrega oficial!`
      : `¡TESORO CAPTURADO! Fuiste el primer cazador verificado en encontrar "${dbMission.title}".`;

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
    prizeLabel,
    input.claimMethod
  );

  const claim: MissionClaim = {
    id: `clm_${crypto.randomUUID().slice(0, 10)}`,
    missionId: dbMission.id,
    brandId: brand.id,
    hunterId: hunter.id,
    alias: hunter.alias,
    whatsapp: hunter.whatsapp,
    claimType,
    claimMethod: input.claimMethod || "QR_SCAN",
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
