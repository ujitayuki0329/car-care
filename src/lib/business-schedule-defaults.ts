import type { Prisma, PrismaClient } from "@prisma/client";
import { getEnvScheduleDefaults } from "@/lib/config";

export type BusinessScheduleDefaults = {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  reservationMinutes: number;
};

export const SETTINGS_ID = "default" as const;

export async function resolveScheduleDefaults(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<BusinessScheduleDefaults> {
  const env = getEnvScheduleDefaults();
  try {
    const row = await db.businessSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return env;
    return {
      openTime: row.openTime,
      closeTime: row.closeTime,
      slotMinutes: row.slotMinutes,
      reservationMinutes: row.reservationMinutes,
    };
  } catch {
    return env;
  }
}
