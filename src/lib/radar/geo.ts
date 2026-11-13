// ============================================================================
// RADAR QUEST - Geodesic Math (Haversine), Paraguay Cities & Link Parser
// ============================================================================

export interface ParaguayCityPreset {
  name: string;
  department: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const PARAGUAY_CITIES: ParaguayCityPreset[] = [
  {
    name: "Encarnación",
    department: "Itapúa",
    lat: -27.3306,
    lng: -55.8667,
    zoom: 15,
  },
  {
    name: "Asunción",
    department: "Capital",
    lat: -25.2822,
    lng: -57.6351,
    zoom: 15,
  },
  {
    name: "Ciudad del Este",
    department: "Alto Paraná",
    lat: -25.5097,
    lng: -54.6111,
    zoom: 15,
  },
  {
    name: "San Lorenzo",
    department: "Central",
    lat: -25.3408,
    lng: -57.5088,
    zoom: 15,
  },
  {
    name: "Luque",
    department: "Central",
    lat: -25.2665,
    lng: -57.4927,
    zoom: 15,
  },
  {
    name: "Villarrica",
    department: "Guairá",
    lat: -25.7806,
    lng: -56.4486,
    zoom: 15,
  },
  {
    name: "Coronel Oviedo",
    department: "Caaguazú",
    lat: -25.4481,
    lng: -56.4411,
    zoom: 15,
  },
  {
    name: "Pedro Juan Caballero",
    department: "Amambay",
    lat: -22.5472,
    lng: -55.7333,
    zoom: 15,
  },
  {
    name: "Pilar",
    department: "Ñeembucú",
    lat: -26.8678,
    lng: -58.2959,
    zoom: 15,
  },
];

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Exact Haversine distance in meters between two WGS84 coordinates.
 */
export function calculateHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Adaptive capture radius calculation:
 * Base = 35m (or mission.captureRadiusMeters) + adaptive GPS phone accuracy tolerance,
 * strictly capped at 65m maximum!
 */
export function calculateEffectiveCaptureRadius(
  baseRadiusMeters = 35,
  gpsAccuracyMeters = 10
): number {
  const safeBase = Math.max(15, Math.min(baseRadiusMeters, 65));
  const safeAccuracy = Number.isFinite(gpsAccuracyMeters)
    ? Math.max(0, gpsAccuracyMeters)
    : 10;

  // Add 60% of reported horizontal GPS uncertainty up to +30m, hard-capped at 65m
  const adaptiveBonus = Math.min(30, safeAccuracy * 0.6);
  return Math.min(65, Number((safeBase + adaptiveBonus).toFixed(2)));
}

/**
 * Generates a deterministic public fuzzy neighborhood center (~180m-260m offset)
 * so the map centers near the zone without exposing secretLat/secretLng in DevTools!
 */
export function computePublicZoneCenter(
  secretLat: number,
  secretLng: number,
  seed: string
): { publicCenterLat: number; publicCenterLng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const offsetMeters = 180 + (Math.abs(hash >> 4) % 90); // 180..270m offset

  const dLat = (offsetMeters * Math.cos(angle)) / 111_320;
  const dLng =
    (offsetMeters * Math.sin(angle)) /
    (111_320 * Math.cos(toRadians(secretLat)));

  return {
    publicCenterLat: Number((secretLat + dLat).toFixed(6)),
    publicCenterLng: Number((secretLng + dLng).toFixed(6)),
  };
}

/**
 * Extracts latitude & longitude from Google Maps URLs, WhatsApp location links,
 * Apple Maps links, or raw coordinate strings.
 */
export function extractCoordinatesFromInput(
  rawInput: string
): { lat: number; lng: number } | null {
  if (!rawInput) return null;
  const text = decodeURIComponent(rawInput.trim());

  // 1. Google Maps !3dLAT!4dLNG pin exact coords (highest priority in long GMap URLs)
  const bangMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    const lat = parseFloat(bangMatch[1]);
    const lng = parseFloat(bangMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Query parameter ?q=LAT,LNG or &ll=LAT,LNG or &query=LAT,LNG or &center=LAT,LNG
  const paramMatch = text.match(
    /[?&](?:q|ll|query|center|daddr|saddr)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i
  );
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Google Maps @LAT,LNG,17z
  const atMatch = text.match(/@(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. Generic pair of signed decimal coordinates anywhere in WhatsApp message or plain text
  const genericMatch = text.match(/(-?\d{1,2}\.\d{3,})\s*[,;/\s]\s*(-?\d{1,3}\.\d{3,})/);
  if (genericMatch) {
    const lat = parseFloat(genericMatch[1]);
    const lng = parseFloat(genericMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export type CardinalDirection4 = "north" | "east" | "south" | "west";

/**
 * Calculates initial bearing in degrees (0..360, where 0=North, 90=East, 180=South, 270=West)
 */
export function calculateBearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function getCardinalDirection4(bearingDeg: number): CardinalDirection4 {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return "east";
  if (normalized >= 135 && normalized < 225) return "south";
  if (normalized >= 225 && normalized < 315) return "west";
  return "north";
}

export interface GpsCoordsSample {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Requests a fresh high-accuracy browser GPS reading (maximumAge: 0) before validating captures.
 * Falls back to `fallbackCoords` only if geolocation is unavailable, times out, or errors.
 */
export async function getFreshGpsCoords(
  fallbackCoords: GpsCoordsSample | null,
  timeoutMs = 5500
): Promise<GpsCoordsSample | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return fallbackCoords;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 10),
        }),
      () => resolve(fallbackCoords),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      }
    );
  });
}

export interface MissionProximityCandidate {
  id: string;
  status: string;
  publicCenterLat: number;
  publicCenterLng: number;
  zoneRadiusMeters: number;
}

export interface RankedMissionEntry<T extends MissionProximityCandidate> {
  mission: T;
  distanceMeters: number;
  isInZone: boolean;
}

/**
 * Formats macro distance to a mission's fuzzy public center without leaking exact treasure coords.
 */
export function formatMacroZoneDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return "";
  if (distanceMeters >= 10_000) {
    return `~${Math.round(distanceMeters / 1000)} km`;
  }
  if (distanceMeters >= 1_000) {
    return `~${(distanceMeters / 1000).toFixed(1)} km`;
  }
  return `~${Math.max(50, Math.round(distanceMeters / 50) * 50)} m`;
}

/**
 * Sorts missions prioritizing ACTIVE drops first, then nearest distance to the player's coordinates.
 */
export function rankMissionsByProximity<T extends MissionProximityCandidate>(
  missions: T[],
  coords: { lat: number; lng: number }
): RankedMissionEntry<T>[] {
  return missions
    .map((mission) => {
      const distanceMeters = calculateHaversineMeters(
        coords.lat,
        coords.lng,
        mission.publicCenterLat,
        mission.publicCenterLng
      );
      return {
        mission,
        distanceMeters,
        isInZone: distanceMeters <= mission.zoneRadiusMeters,
      };
    })
    .sort((a, b) => {
      const aActive = a.mission.status === "ACTIVE" ? 0 : 1;
      const bActive = b.mission.status === "ACTIVE" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.distanceMeters - b.distanceMeters;
    });
}

/**
 * Generates a deterministic coordinate offset from an origin point given bearing & meters.
 */
export function offsetCoordsByBearingMeters(
  originLat: number,
  originLng: number,
  bearingDeg: number,
  distanceMeters: number
): { lat: number; lng: number } {
  const rad = toRadians(bearingDeg);
  const dLat = (distanceMeters * Math.cos(rad)) / 111_320;
  const cosLat = Math.max(0.15, Math.cos(toRadians(originLat)));
  const dLng = (distanceMeters * Math.sin(rad)) / (111_320 * cosLat);

  return {
    lat: Number((originLat + dLat).toFixed(6)),
    lng: Number((originLng + dLng).toFixed(6)),
  };
}

export interface DeterministicBonusBeacon {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Generates 2 deterministic route bonus beacons placed at 40%-50% between
 * the hunter's starting mission anchor and the fuzzy public zone center
 * (NEVER derived from secretLat/secretLng, with lateral spread to avoid leaking a straight ray).
 */
export function computeMissionBonusBeacons(
  missionId: string,
  publicCenterLat: number,
  publicCenterLng: number,
  zoneRadiusMeters: number,
  hunterAnchor?: { lat: number; lng: number } | null
): DeterministicBonusBeacon[] {
  let hash = 2166136261;
  for (let i = 0; i < missionId.length; i++) {
    hash ^= missionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let pos1: { lat: number; lng: number } | null = null;
  let pos2: { lat: number; lng: number } | null = null;

  if (
    hunterAnchor &&
    Number.isFinite(hunterAnchor.lat) &&
    Number.isFinite(hunterAnchor.lng)
  ) {
    const distFromZone = calculateHaversineMeters(
      publicCenterLat,
      publicCenterLng,
      hunterAnchor.lat,
      hunterAnchor.lng
    );

    if (distFromZone >= 320) {
      const bearingToHunter = calculateBearingDegrees(
        publicCenterLat,
        publicCenterLng,
        hunterAnchor.lat,
        hunterAnchor.lng
      );
      const effectiveSpan = Math.min(
        distFromZone,
        Math.max(1800, zoneRadiusMeters * 0.95)
      );
      const frac1 = 0.4 + (Math.abs(hash >>> 4) % 5) / 100; // 40% - 44%
      const frac2 = 0.46 + (Math.abs(hash >>> 12) % 5) / 100; // 46% - 50%

      const dist1 = Math.max(
        160,
        Math.min(zoneRadiusMeters * 0.65, effectiveSpan * frac1)
      );
      const dist2 = Math.max(
        190,
        Math.min(zoneRadiusMeters * 0.68, effectiveSpan * frac2)
      );

      const spread1 = 18 + (Math.abs(hash >>> 16) % 13); // 18°..30° left
      const spread2 = 18 + (Math.abs(hash >>> 20) % 13); // 18°..30° right

      pos1 = offsetCoordsByBearingMeters(
        publicCenterLat,
        publicCenterLng,
        bearingToHunter - spread1,
        dist1
      );
      pos2 = offsetCoordsByBearingMeters(
        publicCenterLat,
        publicCenterLng,
        bearingToHunter + spread2,
        dist2
      );
    }
  }

  if (!pos1 || !pos2) {
    const maxOffset = Math.max(220, Math.min(620, zoneRadiusMeters * 0.62));
    const minOffset = Math.min(
      maxOffset - 40,
      Math.max(180, zoneRadiusMeters * 0.28)
    );
    const span = Math.max(35, maxOffset - minOffset);

    const angle1 = Math.abs(hash) % 360;
    const dist1 = minOffset + (Math.abs(hash >>> 8) % span);
    pos1 = offsetCoordsByBearingMeters(
      publicCenterLat,
      publicCenterLng,
      angle1,
      dist1
    );

    const angle2 = (angle1 + 135 + (Math.abs(hash >>> 12) % 85)) % 360;
    const dist2 = minOffset + (Math.abs(hash >>> 16) % span);
    pos2 = offsetCoordsByBearingMeters(
      publicCenterLat,
      publicCenterLng,
      angle2,
      dist2
    );
  }

  return [
    {
      id: `${missionId}:beacon_alpha`,
      label: "BALIZA ALFA",
      lat: pos1.lat,
      lng: pos1.lng,
    },
    {
      id: `${missionId}:beacon_beta`,
      label: "BALIZA BETA",
      lat: pos2.lat,
      lng: pos2.lng,
    },
  ];
}

export interface BearingSector8 {
  sectorCode: "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
  sectorLabel: string;
  centerBearingDeg: number;
}

const SECTORS_8: BearingSector8[] = [
  { sectorCode: "N", sectorLabel: "Norte", centerBearingDeg: 0 },
  { sectorCode: "NE", sectorLabel: "Noreste", centerBearingDeg: 45 },
  { sectorCode: "E", sectorLabel: "Este", centerBearingDeg: 90 },
  { sectorCode: "SE", sectorLabel: "Sureste", centerBearingDeg: 135 },
  { sectorCode: "S", sectorLabel: "Sur", centerBearingDeg: 180 },
  { sectorCode: "SO", sectorLabel: "Suroeste", centerBearingDeg: 225 },
  { sectorCode: "O", sectorLabel: "Oeste", centerBearingDeg: 270 },
  { sectorCode: "NO", sectorLabel: "Noroeste", centerBearingDeg: 315 },
];

/**
 * Maps an exact bearing into a coarse 45-degree sector (zero exact coordinate leakage).
 */
export function computeBearingSector8(bearingDeg: number): BearingSector8 {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const idx = Math.floor(((normalized + 22.5) % 360) / 45);
  return SECTORS_8[idx] || SECTORS_8[0];
}

/**
 * Picks the closest ACTIVE mission (or closest mission overall if none are ACTIVE).
 */
export function pickNearestMission<T extends MissionProximityCandidate>(
  missions: T[],
  coords: { lat: number; lng: number }
): T | null {
  return rankMissionsByProximity(missions, coords)[0]?.mission ?? null;
}

