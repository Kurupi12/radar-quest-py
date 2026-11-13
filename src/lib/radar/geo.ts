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
 * Picks the closest ACTIVE mission (or closest mission overall if none are ACTIVE).
 */
export function pickNearestMission<T extends MissionProximityCandidate>(
  missions: T[],
  coords: { lat: number; lng: number }
): T | null {
  return rankMissionsByProximity(missions, coords)[0]?.mission ?? null;
}

