import type {
  TacticalCooldownSnapshot,
  TacticalHint,
  TacticalTrend,
  ThermalState,
} from "@/types/radar";
import { calculateHaversineMeters } from "@/lib/radar/geo";

// ============================================================================
// RADAR QUEST PY - TacticalVectorAssistance Module
// Kinematic Trajectory Analysis & Dynamic 16-Bit Walking Hints (15s-30s Window)
// ============================================================================

export const VEHICLE_OVERRIDE_MESSAGE =
  "MODO VEHÍCULO ACTIVO: ESTACIONA Y CONTINÚA A PIE PARA FIJAR RUMBO";

/** Cooldown window (10s, inside 8-12s target) to prevent HUD flicker & spam */
const TACTICAL_COOLDOWN_MS = 10_000;
const MAX_CACHE_ENTRIES = 1_000;

export interface KinematicPingSample {
  lat: number;
  lng: number;
  distanceMeters: number;
  speedKmh: number;
  inVehicleMode: boolean;
  isAnomaly: boolean;
  timestampMs: number;
}

export interface EvaluateTacticalVectorParams {
  missionId: string;
  hunterId: string;
  nowMs: number;
  currentDistanceMeters: number;
  currentSpeedKmh: number;
  inVehicleMode: boolean;
  isTeleportAnomaly: boolean;
  thermalState: ThermalState;
  recentSamples: KinematicPingSample[];
  clientPrevState?: TacticalCooldownSnapshot | null;
}

export interface TacticalEvaluationResult {
  tacticalHint: TacticalHint;
  snapshot: TacticalCooldownSnapshot;
}

const globalForTactical = globalThis as unknown as {
  __rqTacticalCooldownCache?: Map<string, TacticalCooldownSnapshot>;
};

function getTacticalCache(): Map<string, TacticalCooldownSnapshot> {
  if (!globalForTactical.__rqTacticalCooldownCache) {
    globalForTactical.__rqTacticalCooldownCache = new Map();
  }
  return globalForTactical.__rqTacticalCooldownCache;
}

function setCachedSnapshot(
  cacheKey: string,
  snapshot: TacticalCooldownSnapshot
): void {
  const cache = getTacticalCache();
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(cacheKey)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(cacheKey, snapshot);
}

/**
 * Evaluates the hunter's 15-30s kinematic trajectory on foot (<20 km/h),
 * computes radial distance differentials (Δd = d_actual - d_anterior),
 * classifies heading trend, and enforces an ~10s anti-flicker cooldown.
 */
export function evaluateTacticalVectorAssistance(
  params: EvaluateTacticalVectorParams
): TacticalEvaluationResult {
  const {
    missionId,
    hunterId,
    nowMs,
    currentDistanceMeters,
    currentSpeedKmh,
    inVehicleMode,
    isTeleportAnomaly,
    thermalState,
    recentSamples,
    clientPrevState,
  } = params;

  const cacheKey = `${missionId}:${hunterId}`;
  const serverPrev = getTacticalCache().get(cacheKey) || null;

  // Pick whichever snapshot is fresher (handles multi-lambda Vercel routing cleanly)
  const prevSnapshot: TacticalCooldownSnapshot | null =
    serverPrev && clientPrevState
      ? serverPrev.emittedAtMs >= clientPrevState.emittedAtMs
        ? serverPrev
        : clientPrevState
      : serverPrev || clientPrevState || null;

  const validSamples = recentSamples
    .filter((s) => !s.isAnomaly)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  // 1. PRIORITY OVERRIDE: Vehicle Mode (>= 20 km/h outside <30m; >= 35 km/h inside <30m capture jitter buffer)
  const vehicleSpeedThresholdKmh =
    currentDistanceMeters < 30 || thermalState === "QUEMANDO" ? 35 : 20;
  const isDriving = inVehicleMode || currentSpeedKmh >= vehicleSpeedThresholdKmh;
  if (isDriving) {
    const baseDist =
      validSamples.length >= 2
        ? validSamples[0].distanceMeters
        : currentDistanceMeters;
    const rawDelta = Number((currentDistanceMeters - baseDist).toFixed(1));

    const vehicleHint: TacticalHint = {
      trend: "NEUTRAL",
      message: VEHICLE_OVERRIDE_MESSAGE,
      deltaMeters: rawDelta,
    };
    const snapshot: TacticalCooldownSnapshot = {
      ...vehicleHint,
      emittedAtMs: nowMs,
      wasVehicle: true,
    };
    setCachedSnapshot(cacheKey, snapshot);
    return { tacticalHint: vehicleHint, snapshot };
  }

  // 2. PRIORITY OVERRIDE: Anti-Spoofing Teleport Anomaly
  if (isTeleportAnomaly || thermalState === "TELEPORT_ANOMALY") {
    const anomalyHint: TacticalHint = {
      trend: "DRIFTING_AWAY",
      message: "ANOMALÍA DE TRAYECTORIA: CAMINA A PIE PARA RECALIBRAR RUMBO",
      deltaMeters: 0,
    };
    const snapshot: TacticalCooldownSnapshot = {
      ...anomalyHint,
      emittedAtMs: nowMs,
      wasVehicle: false,
    };
    setCachedSnapshot(cacheKey, snapshot);
    return { tacticalHint: anomalyHint, snapshot };
  }

  // 3. Filter walking-only samples within the kinematic window (15s - 30s)
  const walkingSamples = validSamples.filter(
    (s) => !s.inVehicleMode && s.speedKmh < (s.distanceMeters < 30 ? 35 : 20)
  );

  let candidateTrend: TacticalTrend = "NEUTRAL";
  let candidateMessage = "CALIBRANDO VECTOR: CAMINA A PIE PARA FIJAR RUMBO";
  let candidateDelta = 0;

  if (walkingSamples.length < 2) {
    if (thermalState === "QUEMANDO") {
      candidateTrend = "CLOSING_IN";
      candidateMessage =
        "SEÑAL EN AUMENTO: OBJETIVO EN RANGO INMEDIATO (<30M)";
      candidateDelta = 0;
    }
  } else {
    const first = walkingSamples[0];
    const prev = walkingSamples[walkingSamples.length - 2];
    const curr = walkingSamples[walkingSamples.length - 1];

    // Differential: Δd = d_actual - d_anterior (negative = closer, positive = farther)
    const stepDelta = curr.distanceMeters - prev.distanceMeters;
    const netDelta = curr.distanceMeters - first.distanceMeters;
    const windowSpanMs = Math.max(0, curr.timestampMs - first.timestampMs);

    // Closest distance reached earlier in the recent window
    let minRecentDistance = first.distanceMeters;
    for (let i = 0; i < walkingSamples.length - 1; i++) {
      if (walkingSamples[i].distanceMeters < minRecentDistance) {
        minRecentDistance = walkingSamples[i].distanceMeters;
      }
    }
    const driftFromClosest = curr.distanceMeters - minRecentDistance;

    // Physical ground path walked & step-by-step radial consistency
    let groundPathMeters = 0;
    let approachingSteps = 0;
    let retreatingSteps = 0;

    for (let i = 1; i < walkingSamples.length; i++) {
      const a = walkingSamples[i - 1];
      const b = walkingSamples[i];
      groundPathMeters += calculateHaversineMeters(a.lat, a.lng, b.lat, b.lng);

      const dd = b.distanceMeters - a.distanceMeters;
      if (dd <= -1.2) approachingSteps += 1;
      else if (dd >= 1.2) retreatingSteps += 1;
    }

    // Classification A: Negative Trend (DRIFTING_AWAY) -> >15m to 25m+ accumulated drift
    if (driftFromClosest >= 15 && stepDelta >= -1.5) {
      candidateTrend = "DRIFTING_AWAY";
      candidateDelta = Number(driftFromClosest.toFixed(1));
      candidateMessage =
        driftFromClosest >= 25
          ? "DESVÍO DETECTADO: EL RASTRO QUEDÓ A TUS ESPALDAS"
          : "ALEJAMIENTO DETECTADO: CORRIGE RUMBO EN SENTIDO OPUESTO";
    }
    // Classification B: Capture Perimeter Lock (<30m walking)
    else if (thermalState === "QUEMANDO") {
      candidateTrend = "CLOSING_IN";
      candidateDelta = Number(netDelta.toFixed(1));
      candidateMessage =
        "SEÑAL EN AUMENTO: OBJETIVO EN RANGO INMEDIATO (<30M)";
    }
    // Classification C: Positive Trend (CLOSING_IN) -> sustained distance reduction on foot
    else if (
      netDelta <= -6 &&
      stepDelta <= 2.5 &&
      approachingSteps >= retreatingSteps &&
      (approachingSteps >= 2 || netDelta <= -10)
    ) {
      candidateTrend = "CLOSING_IN";
      candidateDelta = Number(netDelta.toFixed(1));
      candidateMessage =
        netDelta <= -20
          ? "VECTOR ÓPTIMO: ACERCAMIENTO DIRECTO AL OBJETIVO"
          : "SEÑAL EN AUMENTO: MANTÉN ESTA DIRECCIÓN";
    }
    // Classification D: Lateral / Tangential Walk (NEUTRAL) -> walked >=12m but flat radial Δd
    else if (
      groundPathMeters >= 12 &&
      Math.abs(netDelta) < 10 &&
      driftFromClosest < 15
    ) {
      candidateTrend = "NEUTRAL";
      candidateDelta = Number(netDelta.toFixed(1));
      candidateMessage = "RUMBO PARALELO: BUSCA UN CRUCE DIRECTO";
    }
    // Classification E: Corner / Block Stagnation (STAGNANT) -> >=10s or >=3 pings with <8m ground movement
    else if (
      (windowSpanMs >= 10_000 || walkingSamples.length >= 3) &&
      groundPathMeters < 8
    ) {
      candidateTrend = "STAGNANT";
      candidateDelta = Number(netDelta.toFixed(1));
      candidateMessage =
        "ESTANCAMIENTO EN ESQUINA: AVANZA UNA CUADRA PARA TRIANGULAR";
    }
    // Classification F: Mild / Transitional Search (NEUTRAL)
    else {
      candidateTrend = "NEUTRAL";
      candidateDelta = Number(stepDelta.toFixed(1));
      candidateMessage = "EXPLORANDO SECTOR: MANTÉN CAMINATA CONSTANTE";
    }
  }

  // 4. Cooldown Filter (~10s): Hold previous message/trend steady unless exiting priority mode or entering QUEMANDO
  if (prevSnapshot) {
    const elapsedMs = nowMs - prevSnapshot.emittedAtMs;
    const exitedVehicle = prevSnapshot.wasVehicle;
    const justEnteredQuemando =
      thermalState === "QUEMANDO" &&
      prevSnapshot.message !== candidateMessage;

    if (!exitedVehicle && !justEnteredQuemando && elapsedMs < TACTICAL_COOLDOWN_MS) {
      const heldHint: TacticalHint = {
        trend: prevSnapshot.trend,
        message: prevSnapshot.message,
        deltaMeters: prevSnapshot.deltaMeters,
      };
      return {
        tacticalHint: heldHint,
        snapshot: prevSnapshot,
      };
    }
  }

  const nextHint: TacticalHint = {
    trend: candidateTrend,
    message: candidateMessage,
    deltaMeters: candidateDelta,
  };
  const nextSnapshot: TacticalCooldownSnapshot = {
    ...nextHint,
    emittedAtMs: nowMs,
    wasVehicle: false,
  };
  setCachedSnapshot(cacheKey, nextSnapshot);

  return {
    tacticalHint: nextHint,
    snapshot: nextSnapshot,
  };
}

