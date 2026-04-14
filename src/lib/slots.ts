import type { BusinessDayOverride, Prisma, PrismaClient, Reservation, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BusinessScheduleDefaults } from "@/lib/business-schedule-defaults";
import { resolveScheduleDefaults } from "@/lib/business-schedule-defaults";
import {
  addMinutesToTime,
  formatISODate,
  intervalsOverlap,
  minutesToTime,
  parseISODateOnly,
  timeToMinutes,
} from "@/lib/time";

type ShiftWithEmployee = Shift & {
  employee: { id: string; active: boolean };
};

export type DayAvailabilitySummary = {
  date: string;
  isOpen: boolean;
  hasAvailableSlot: boolean;
};

export type SlotDetail = {
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  available: boolean;
};

function jsWeekdayToDb(d: Date): number {
  return d.getUTCDay();
}

export async function loadSchedulingContext(date: Date): Promise<{
  date: Date;
  iso: string;
  weekday: number;
  defaults: BusinessScheduleDefaults;
  override: BusinessDayOverride | null;
  weekdayRule: { isClosed: boolean } | null;
  shifts: ShiftWithEmployee[];
  reservations: Pick<Reservation, "startTime" | "endTime" | "status">[];
}> {
  const defaults = await resolveScheduleDefaults(prisma);
  const iso = formatISODate(date);
  const weekday = jsWeekdayToDb(date);
  const dayStart = parseISODateOnly(iso);

  const [override, weekdayRule, shifts, reservations] = await Promise.all([
    prisma.businessDayOverride.findUnique({ where: { date: dayStart } }),
    prisma.weekdayRule.findUnique({ where: { weekday } }),
    prisma.shift.findMany({
      where: { workDate: dayStart },
      include: { employee: true },
    }),
    prisma.reservation.findMany({
      where: { date: dayStart, status: "CONFIRMED" },
      select: { startTime: true, endTime: true, status: true },
    }),
  ]);

  return {
    date: dayStart,
    iso,
    weekday,
    defaults,
    override,
    weekdayRule,
    shifts: shifts.filter((s) => s.employee.active),
    reservations,
  };
}

export function effectiveBusinessHours(ctx: Awaited<ReturnType<typeof loadSchedulingContext>>): {
  open: boolean;
  openTime: string;
  closeTime: string;
} {
  if (ctx.override?.isClosed) return { open: false, openTime: "", closeTime: "" };
  if (ctx.weekdayRule?.isClosed) return { open: false, openTime: "", closeTime: "" };

  const { defaults } = ctx;
  const openTime = ctx.override?.openTime ?? defaults.openTime;
  const closeTime = ctx.override?.closeTime ?? defaults.closeTime;
  return { open: true, openTime, closeTime };
}

export function shiftCoversSlot(
  shift: { startTime: string; endTime: string },
  slotStartMin: number,
  slotEndMin: number,
): boolean {
  const shS = timeToMinutes(shift.startTime);
  const shE = timeToMinutes(shift.endTime);
  return shS <= slotStartMin && shE >= slotEndMin;
}

export function countOverlappingReservations(
  reservations: Pick<Reservation, "startTime" | "endTime" | "status">[],
  slotStartMin: number,
  slotEndMin: number,
): number {
  return reservations.filter((r) => {
    if (r.status !== "CONFIRMED") return false;
    const rs = timeToMinutes(r.startTime);
    const re = timeToMinutes(r.endTime);
    return intervalsOverlap(slotStartMin, slotEndMin, rs, re);
  }).length;
}

export function buildSlotsForDay(ctx: Awaited<ReturnType<typeof loadSchedulingContext>>): SlotDetail[] {
  const hours = effectiveBusinessHours(ctx);
  if (!hours.open) return [];

  const { defaults } = ctx;
  const openM = timeToMinutes(hours.openTime);
  const closeM = timeToMinutes(hours.closeTime);
  const step = defaults.slotMinutes;
  const dur = defaults.reservationMinutes;

  const slots: SlotDetail[] = [];
  for (let t = openM; t + dur <= closeM; t += step) {
    const startTime = minutesToTime(t);
    const endTime = addMinutesToTime(startTime, dur);
    const slotEnd = timeToMinutes(endTime);

    const capacity = ctx.shifts.filter((s) => shiftCoversSlot(s, t, slotEnd)).length;
    const booked = countOverlappingReservations(ctx.reservations, t, slotEnd);
    const available = capacity > 0 && booked < capacity;

    slots.push({ startTime, endTime, capacity, booked, available });
  }

  return slots;
}

function hasAvailableSlotForDay(
  ctx: Pick<
    Awaited<ReturnType<typeof loadSchedulingContext>>,
    "defaults" | "override" | "weekdayRule" | "shifts" | "reservations"
  >,
): boolean {
  const hours = effectiveBusinessHours(ctx as Awaited<ReturnType<typeof loadSchedulingContext>>);
  if (!hours.open) return false;

  const openM = timeToMinutes(hours.openTime);
  const closeM = timeToMinutes(hours.closeTime);
  const step = ctx.defaults.slotMinutes;
  const dur = ctx.defaults.reservationMinutes;

  const shiftRanges = ctx.shifts.map((s) => ({
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime),
  }));
  const reservationRanges = ctx.reservations.map((r) => ({
    start: timeToMinutes(r.startTime),
    end: timeToMinutes(r.endTime),
  }));

  for (let t = openM; t + dur <= closeM; t += step) {
    const slotEnd = t + dur;
    let capacity = 0;
    for (const s of shiftRanges) {
      if (s.start <= t && s.end >= slotEnd) capacity += 1;
    }
    if (capacity === 0) continue;

    let booked = 0;
    for (const r of reservationRanges) {
      if (intervalsOverlap(t, slotEnd, r.start, r.end)) booked += 1;
      if (booked >= capacity) break;
    }
    if (booked < capacity) return true;
  }

  return false;
}

export async function getMonthAvailability(year: number, month: number): Promise<DayAvailabilitySummary[]> {
  const last = new Date(Date.UTC(year, month, 0));
  const lastDay = last.getUTCDate();
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDayDate = new Date(Date.UTC(year, month - 1, lastDay));

  const [defaults, weekdayRules, overrides, shifts, reservations] = await Promise.all([
    resolveScheduleDefaults(prisma),
    prisma.weekdayRule.findMany(),
    prisma.businessDayOverride.findMany({
      where: { date: { gte: firstDay, lte: lastDayDate } },
    }),
    prisma.shift.findMany({
      where: { workDate: { gte: firstDay, lte: lastDayDate } },
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, active: true } },
      },
    }),
    prisma.reservation.findMany({
      where: {
        date: { gte: firstDay, lte: lastDayDate },
        status: "CONFIRMED",
      },
      select: { date: true, startTime: true, endTime: true, status: true },
    }),
  ]);

  const weekdayRuleByWd = new Map(weekdayRules.map((r) => [r.weekday, r]));
  const overrideByIso = new Map<string, BusinessDayOverride>();
  for (const o of overrides) {
    overrideByIso.set(formatISODate(o.date), o);
  }

  const shiftsByIso = new Map<string, ShiftWithEmployee[]>();
  for (const s of shifts) {
    const iso = formatISODate(s.workDate);
    const arr = shiftsByIso.get(iso) ?? [];
    arr.push(s);
    shiftsByIso.set(iso, arr);
  }

  const reservationsByIso = new Map<string, Pick<Reservation, "startTime" | "endTime" | "status">[]>();
  for (const r of reservations) {
    const iso = formatISODate(r.date);
    const arr = reservationsByIso.get(iso) ?? [];
    arr.push({ startTime: r.startTime, endTime: r.endTime, status: r.status });
    reservationsByIso.set(iso, arr);
  }

  const out: DayAvailabilitySummary[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const iso = formatISODate(date);
    const weekday = jsWeekdayToDb(date);
    const dayStart = parseISODateOnly(iso);

    const ctx = {
      date: dayStart,
      iso,
      weekday,
      defaults,
      override: overrideByIso.get(iso) ?? null,
      weekdayRule: weekdayRuleByWd.get(weekday) ?? null,
      shifts: (shiftsByIso.get(iso) ?? []).filter((s) => s.employee.active),
      reservations: reservationsByIso.get(iso) ?? [],
    };

    const hours = effectiveBusinessHours(ctx);
    if (!hours.open) {
      out.push({ date: iso, isOpen: false, hasAvailableSlot: false });
      continue;
    }
    const hasAvailableSlot = hasAvailableSlotForDay(ctx);
    out.push({ date: iso, isOpen: true, hasAvailableSlot });
  }

  return out;
}

export async function assertSlotStillAvailable(
  tx: Prisma.TransactionClient,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<void> {
  const ctx = await loadSchedulingContextInTx(tx, date);
  const slots = buildSlotsForDay(ctx);
  const slot = slots.find((s) => s.startTime === startTime && s.endTime === endTime);
  if (!slot || !slot.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }
}

async function loadSchedulingContextInTx(tx: Prisma.TransactionClient, date: Date) {
  const defaults = await resolveScheduleDefaults(tx);
  const iso = formatISODate(date);
  const weekday = jsWeekdayToDb(date);
  const dayStart = parseISODateOnly(iso);

  const [override, weekdayRule, shifts, reservations] = await Promise.all([
    tx.businessDayOverride.findUnique({ where: { date: dayStart } }),
    tx.weekdayRule.findUnique({ where: { weekday } }),
    tx.shift.findMany({
      where: { workDate: dayStart },
      include: { employee: true },
    }),
    tx.reservation.findMany({
      where: { date: dayStart, status: "CONFIRMED" },
      select: { startTime: true, endTime: true, status: true },
    }),
  ]);

  return {
    date: dayStart,
    iso,
    weekday,
    defaults,
    override,
    weekdayRule,
    shifts: shifts.filter((s) => s.employee.active),
    reservations,
  };
}
