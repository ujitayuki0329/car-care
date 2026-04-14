import { NextRequest, NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/api-admin";
import { buildSlotsForDay } from "@/lib/slots";
import { resolveScheduleDefaults } from "@/lib/business-schedule-defaults";
import { parseISODateOnly } from "@/lib/time";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const dateStr = new URL(req.url).searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date が必要です" }, { status: 400 });
  }

  const date = parseISODateOnly(dateStr);
  const weekday = date.getUTCDay();
  const [defaults, override, weekdayRule, shifts, reservations] = await Promise.all([
    resolveScheduleDefaults(prisma),
    prisma.businessDayOverride.findUnique({ where: { date } }),
    prisma.weekdayRule.findUnique({ where: { weekday } }),
    prisma.shift.findMany({
      where: { workDate: date },
      include: { employee: true },
    }),
    prisma.reservation.findMany({
      where: { date },
      orderBy: [{ startTime: "asc" }],
    }),
  ]);

  const slots = buildSlotsForDay({
    date,
    iso: dateStr,
    weekday,
    defaults,
    override,
    weekdayRule,
    shifts: shifts.filter((s) => s.employee.active),
    reservations: reservations
      .filter((r) => r.status === "CONFIRMED")
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime, status: r.status })),
  });

  return NextResponse.json({ slots, reservations, shifts });
}
