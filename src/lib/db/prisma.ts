import {
  PrismaClient,
  type ThermalState as PrismaThermalState,
} from "@prisma/client";
import type { ThermalState } from "@/types/radar";

const globalForPrisma = globalThis as unknown as {
  __radarPrisma?: PrismaClient;
};

/**
 * Returns true when a PostgreSQL connection string (Neon / Supabase) is configured.
 */
export function isCloudDbEnabled(): boolean {
  const url = process.env.DATABASE_URL?.trim() || "";
  return (
    url.startsWith("postgresql://") ||
    url.startsWith("postgres://") ||
    url.startsWith("prisma+postgres://")
  );
}

/**
 * Lazy singleton PrismaClient compatible with Next.js HMR and Neon/Supabase poolers.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__radarPrisma) {
    globalForPrisma.__radarPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.__radarPrisma;
}

export function toPrismaThermal(state: ThermalState): PrismaThermalState {
  if (state === "FUERA DE ZONA") return "FUERA_DE_ZONA";
  return state as PrismaThermalState;
}

export function fromPrismaThermal(state: PrismaThermalState): ThermalState {
  if (state === "FUERA_DE_ZONA") return "FUERA DE ZONA";
  return state as ThermalState;
}

