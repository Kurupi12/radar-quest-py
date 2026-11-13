// ============================================================================
// RADAR QUEST - Core Domain Types (Multi-Tenant White-Label SaaS - Fase 2)
// ============================================================================

export type MissionStatus = "DRAFT" | "ACTIVE" | "CAPTURED" | "PAUSED";
export type ValidationMode = "QR_SCAN" | "PRESENTIAL_GPS" | "HYBRID";

export type ThermalState =
  | "FUERA DE ZONA"
  | "CONGELADO"
  | "TIBIO"
  | "CALIENTE"
  | "QUEMANDO"
  | "TELEPORT_ANOMALY";

export type ClaimType =
  | "MAJOR_PRIZE"
  | "CONSOLATION_CURIOUS"
  | "CONSOLATION_LATE";

/**
 * Full Server-Side Brand Entity (includes 6-digit adminPin).
 * Use toPublicBrand() before sending to player-facing pages/APIs!
 */
export interface Brand {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoEmoji: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  whatsapp: string;
  requireAdult18: boolean;
  missionCredits: number;
  cityDefault: string;
  /** 6-digit numeric PIN for Merchant Panel (/b/[brand]/admin) */
  adminPin: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sanitized Brand safe for public player views (excludes adminPin).
 */
export type PublicBrand = Omit<Brand, "adminPin">;

export interface ReusableQrNode {
  id: string;
  code: string;
  label: string;
  brandId: string;
  assignedMissionId: string | null;
  active: boolean;
  createdAt: string;
}

/**
 * Full server-side Mission entity (contains secretLat & secretLng).
 * NEVER serialize directly to player-facing endpoints!
 */
export interface Mission {
  id: string;
  brandId: string;
  title: string;
  city: string;
  zoneHint: string;
  secretLat: number;
  secretLng: number;
  publicCenterLat: number;
  publicCenterLng: number;
  captureRadiusMeters: number; // Base 35m
  zoneRadiusMeters: number; // Default 3500m
  qrToken: string;
  nodeCode: string | null;
  prizeTitle: string;
  consolationTitle: string;
  minPingsForMajorPrize: number;
  validationMode: ValidationMode;
  status: MissionStatus;
  winnerHunterId: string | null;
  winnerAlias: string | null;
  winnerClaimCode: string | null;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sanitized public Mission DTO safe to send to players.
 */
export interface PublicMission {
  id: string;
  brandId: string;
  title: string;
  city: string;
  zoneHint: string;
  publicCenterLat: number;
  publicCenterLng: number;
  zoneRadiusMeters: number;
  prizeTitle: string;
  consolationTitle: string;
  minPingsForMajorPrize: number;
  validationMode: ValidationMode;
  status: MissionStatus;
  winnerAlias: string | null;
  capturedAt: string | null;
}

export interface Hunter {
  id: string;
  alias: string;
  whatsapp: string;
  isAdult18: boolean;
  createdAt: string;
}

/**
 * Individual Telemetry Ping Event (HunterPing table in PostgreSQL)
 */
export interface HunterPing {
  id: string;
  missionId: string;
  hunterId: string;
  alias: string;
  lat: number;
  lng: number;
  accuracy: number;
  distanceMeters: number;
  speedKmh: number;
  inVehicleMode: boolean;
  isAnomaly: boolean;
  thermalState: ThermalState;
  createdAt: string;
}

export interface HunterSessionPayload {
  hunterId: string;
  alias: string;
  whatsapp: string;
  isAdult18: boolean;
  brandSlug: string;
  iat: number;
}

export interface BrandSessionPayload {
  role: "BRAND_ADMIN";
  brandId: string;
  brandSlug: string;
  iat: number;
  exp: number;
}

export interface SuperAdminSessionPayload {
  role: "SUPER_ADMIN";
  studio: "CeroUno Studio";
  iat: number;
  exp: number;
}

export interface BrandLead {
  id: string;
  brandId: string;
  hunterId: string;
  alias: string;
  whatsapp: string;
  isAdult18: boolean;
  sourceMissionId: string | null;
  city: string;
  createdAt: string;
}

export interface HunterMissionTelemetry {
  id: string;
  missionId: string;
  hunterId: string;
  alias: string;
  lastLat: number;
  lastLng: number;
  lastAccuracy: number;
  lastDistanceMeters: number;
  speedKmh: number;
  inVehicleMode: boolean;
  thermalState: ThermalState;
  pingCount: number;
  validHuntPings: number;
  anomalyFlags: number;
  firstPingAt: string;
  lastPingAt: string;
}

export interface MissionClaim {
  id: string;
  missionId: string;
  brandId: string;
  hunterId: string;
  alias: string;
  whatsapp: string;
  claimType: ClaimType;
  claimMethod?: "QR_SCAN" | "PRESENTIAL_GPS";
  couponCode: string;
  prizeLabel: string;
  distanceAtClaimMeters: number;
  accuracyAtClaimMeters: number;
  effectiveRadiusMeters: number;
  proofOfHuntPassed: boolean;
  whatsappRedeemUrl: string;
  claimedAt: string;
}

export interface CreditTransaction {
  id: string;
  brandId: string;
  delta: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  brandId: string;
  city: string;
  hunterId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  thermalState: ThermalState;
  missionId: string;
}

export interface BrandAnalyticsSummary {
  /** Total unique hunters across telemetry, pings, leads & claims for this brand */
  uniqueHunters: number;
  /** Average capture duration in minutes across captured missions (null if none captured yet) */
  avgCaptureMinutes: number | null;
  /** Percentage (0..100) of unique hunters who successfully claimed a coupon/prize */
  claimConversionRate: number;
  /** Total historical HunterPing rows recorded */
  totalHistoricalPings: number;
  /** Active Web Push subscribers for this brand */
  pushSubscribersCount: number;
}

export type TacticalTrend =
  | "CLOSING_IN"
  | "DRIFTING_AWAY"
  | "STAGNANT"
  | "NEUTRAL";

export interface TacticalHint {
  trend: TacticalTrend;
  message: string;
  deltaMeters: number;
}

export interface TacticalCooldownSnapshot {
  trend: TacticalTrend;
  message: string;
  deltaMeters: number;
  emittedAtMs: number;
  wasVehicle: boolean;
}

export interface RadarPingRequest {
  missionId: string;
  brandSlug: string;
  lat: number;
  lng: number;
  accuracy: number;
  hunterId: string;
  alias: string;
  sessionToken?: string;
  prevTacticalState?: TacticalCooldownSnapshot | null;
}

export interface DangerAlert {
  active: boolean;
  rivalCount: number;
  message: string | null;
}

export type ClimaxLevel = 1 | 2 | 3;

export interface RouteBonusBeacon {
  id: string;
  label: string;
  lat: number;
  lng: number;
  collected: boolean;
}

export interface RadarPingResponse {
  ok: boolean;
  thermalState: ThermalState;
  heatIntensity: number;
  /** Non-leaking sub-progression inside <30m (1: 20-30m, 2: 10-20m, 3: <10m) */
  climaxLevel?: ClimaxLevel | null;
  inVehicleMode: boolean;
  speedKmh: number;
  vehicleMessage: string | null;
  anomalyMessage: string | null;
  activeHuntersCount: number;
  dangerAlert: DangerAlert;
  tacticalHint: TacticalHint;
  tacticalStateSnapshot?: TacticalCooldownSnapshot;
  proofOfHuntProgress: {
    currentValidPings: number;
    requiredPings: number;
    ready: boolean;
  };
  bonusNodes?: RouteBonusBeacon[];
  newlyCollectedBonusNodeId?: string | null;
  triangulationCooldownBoostMs?: number;
  /** True only when thermalState === 'QUEMANDO' (<30m) and walking (<20 km/h) */
  canOpenQrScanner: boolean;
  canClaimPresential: boolean;
  validationMode: ValidationMode;
  missionStatus: MissionStatus;
  winnerAlias: string | null;
  serverTimestamp: string;
}

export interface TriangulateRequest {
  missionId: string;
  brandSlug?: string;
  lat: number;
  lng: number;
  sessionToken?: string;
}

export interface TriangulationResponse {
  ok: boolean;
  sectorCode?: "N" | "NE" | "E" | "SE" | "S" | "SO" | "O" | "NO";
  sectorLabel?: string;
  centerBearingDeg?: number;
  sweepArcDeg?: number;
  cooldownRemainingSeconds?: number;
  nextAvailableAtMs?: number;
  expiresAtMs?: number;
  message: string;
}

export interface HunterClaimSummary {
  id: string;
  missionId: string;
  missionTitle: string;
  city: string;
  claimType: ClaimType;
  claimMethod?: "QR_SCAN" | "PRESENTIAL_GPS";
  couponCode: string;
  prizeLabel: string;
  whatsappRedeemUrl: string;
  proofOfHuntPassed: boolean;
  claimedAt: string;
}

export interface BrandLeaderboardEntry {
  rank: number;
  hunterId: string;
  alias: string;
  capturesCount: number;
  majorPrizesCount: number;
  fastestCaptureSeconds: number | null;
  bestValidPings: number;
  cities: string[];
  score: number;
  lastCaptureAt: string | null;
}

export interface HunterPersonalStats {
  hunterId: string;
  alias: string;
  rank: number | null;
  capturesCount: number;
  majorPrizesCount: number;
  fastestCaptureSeconds: number | null;
  totalValidPings: number;
  missionsTracked: number;
  claims: HunterClaimSummary[];
}

export interface BrandLeaderboardResponse {
  ok: boolean;
  brandSlug: string;
  cities: string[];
  selectedCity: string | null;
  leaderboard: BrandLeaderboardEntry[];
  myStats: HunterPersonalStats | null;
}

export interface RadarClaimRequest {
  tokenOrNodeCode: string;
  claimMethod?: "QR_SCAN" | "PRESENTIAL_GPS";
  brandSlug: string;
  missionId?: string;
  lat: number;
  lng: number;
  accuracy: number;
  hunterId: string;
  alias?: string;
  sessionToken?: string;
}

export interface RadarClaimResponse {
  ok: boolean;
  errorCode?:
    | "INVALID_TOKEN"
    | "MISSION_INACTIVE"
    | "OUT_OF_CAPTURE_RADIUS"
    | "HUNTER_NOT_REGISTERED"
    | "AGE_RESTRICTION"
    | "TELEPORT_LOCKED";
  message: string;
  claim?: MissionClaim;
  missionTitle?: string;
  brandName?: string;
}

export interface DatabaseSchema {
  brands: Brand[];
  reusableNodes: ReusableQrNode[];
  missions: Mission[];
  hunters: Hunter[];
  hunterPings: HunterPing[];
  leads: BrandLead[];
  telemetry: HunterMissionTelemetry[];
  claims: MissionClaim[];
  creditLedger: CreditTransaction[];
  pushSubscriptions: PushSubscriptionRecord[];
}
