import type { Prisma, PrismaClient } from "@prisma/client";
import { getEnvScheduleDefaults } from "@/lib/config";

export type BusinessScheduleDefaults = {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  reservationMinutes: number;
};

export const SETTINGS_ID = "default" as const;
const SETTINGS_CACHE_TTL_MS = 30_000;

let cachedDefaults: BusinessScheduleDefaults | null = null;
let cachedAt = 0;

export async function resolveScheduleDefaults(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<BusinessScheduleDefaults> {
  const now = Date.now();
  // TransactionClient では同一トランザクション整合性を優先してキャッシュしない。
  const isPrismaClient = "$connect" in db;
  if (isPrismaClient && cachedDefaults && now - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedDefaults;
  }

  const env = getEnvScheduleDefaults();
  try {
    const row = await db.businessSettings.findUnique({ where: { id: SETTINGS_ID } });
    const resolved = !row
      ? env
      : {
      openTime: row.openTime,
      closeTime: row.closeTime,
      slotMinutes: row.slotMinutes,
      reservationMinutes: row.reservationMinutes,
    };
    if (isPrismaClient) {
      cachedDefaults = resolved;
      cachedAt = now;
    }
    return resolved;
  } catch {
    return env;
  }
}
