function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getEnvScheduleDefaults() {
  return {
    openTime: process.env.BUSINESS_OPEN_TIME ?? "09:00",
    closeTime: process.env.BUSINESS_CLOSE_TIME ?? "18:00",
    slotMinutes: envInt("SLOT_MINUTES", 30),
    reservationMinutes: envInt("RESERVATION_DURATION_MINUTES", 60),
  };
}

export function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET が未設定か短すぎます（16文字以上）");
  }
  return s;
}

/** @deprecated スケジュールは resolveScheduleDefaults / getEnvScheduleDefaults を使用 */
export function getBusinessDefaults() {
  return {
    ...getEnvScheduleDefaults(),
    authSecret: getAuthSecret(),
  };
}
