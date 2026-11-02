-- ============================================================================
-- RADAR QUEST - Esquema SQL Multi-Tenant Cloud (Neon / Supabase PostgreSQL)
-- Fase 2: Brand PINs, HunterPing Indexado y Claim Atómico
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  logo_emoji TEXT NOT NULL DEFAULT 'radar',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#a855f7',
  secondary_color TEXT NOT NULL DEFAULT '#00f0ff',
  whatsapp TEXT NOT NULL,
  require_adult_18 BOOLEAN NOT NULL DEFAULT TRUE,
  mission_credits INTEGER NOT NULL DEFAULT 5,
  city_default TEXT NOT NULL DEFAULT 'Encarnación',
  admin_pin VARCHAR(6) NOT NULL DEFAULT '420420',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reusable_qr_nodes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  assigned_mission_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  zone_hint TEXT NOT NULL,
  secret_lat DOUBLE PRECISION NOT NULL,
  secret_lng DOUBLE PRECISION NOT NULL,
  public_center_lat DOUBLE PRECISION NOT NULL,
  public_center_lng DOUBLE PRECISION NOT NULL,
  capture_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 35.0,
  zone_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 3500.0,
  qr_token TEXT UNIQUE NOT NULL,
  node_code TEXT,
  prize_title TEXT NOT NULL,
  consolation_title TEXT NOT NULL DEFAULT 'Cupón Explorador Curioso - 15% OFF',
  min_pings_for_major_prize INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'CAPTURED', 'PAUSED')),
  winner_hunter_id TEXT,
  winner_alias TEXT,
  winner_claim_code TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alias TEXT NOT NULL,
  whatsapp TEXT UNIQUE NOT NULL,
  is_adult_18 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunter_pings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  hunter_id TEXT NOT NULL REFERENCES hunters(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
  in_vehicle_mode BOOLEAN NOT NULL DEFAULT FALSE,
  is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  thermal_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunter_mission_telemetry (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  hunter_id TEXT NOT NULL REFERENCES hunters(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  last_lat DOUBLE PRECISION NOT NULL,
  last_lng DOUBLE PRECISION NOT NULL,
  last_accuracy DOUBLE PRECISION NOT NULL,
  last_distance_meters DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
  in_vehicle_mode BOOLEAN NOT NULL DEFAULT FALSE,
  thermal_state TEXT NOT NULL,
  ping_count INTEGER NOT NULL DEFAULT 1,
  valid_hunt_pings INTEGER NOT NULL DEFAULT 0,
  anomaly_flags INTEGER NOT NULL DEFAULT 0,
  first_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, hunter_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  hunter_id TEXT NOT NULL REFERENCES hunters(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('MAJOR_PRIZE', 'CONSOLATION_CURIOUS', 'CONSOLATION_LATE')),
  coupon_code TEXT UNIQUE NOT NULL,
  prize_label TEXT NOT NULL,
  distance_at_claim_meters DOUBLE PRECISION NOT NULL,
  accuracy_at_claim_meters DOUBLE PRECISION NOT NULL,
  effective_radius_meters DOUBLE PRECISION NOT NULL,
  proof_of_hunt_passed BOOLEAN NOT NULL,
  whatsapp_redeem_url TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  hunter_id TEXT NOT NULL REFERENCES hunters(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  is_adult_18 BOOLEAN NOT NULL DEFAULT TRUE,
  source_mission_id TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, whatsapp)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  hunter_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices Críticos de Baja Latencia (Telemetría, Claim & Web Push)
CREATE INDEX IF NOT EXISTS idx_missions_brand_status ON missions(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_missions_qr_token ON missions(qr_token);
CREATE INDEX IF NOT EXISTS idx_hunter_pings_mission_hunter_time ON hunter_pings(mission_id, hunter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunter_pings_mission_time ON hunter_pings(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_mission_last_ping ON hunter_mission_telemetry(mission_id, last_ping_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_mission_hunter ON claims(mission_id, hunter_id);
CREATE INDEX IF NOT EXISTS idx_claims_mission_type ON claims(mission_id, claim_type);
CREATE INDEX IF NOT EXISTS idx_leads_brand_created ON brand_leads(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_brand_city ON push_subscriptions(brand_id, city, active);
