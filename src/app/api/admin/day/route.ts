import { NextRequest, NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/api-admin";
import { buildSlotsForDay, loadSchedulingContext } from "@/lib/slots";
import { parseISODateOnly } from "@/lib/time";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const dateStr = new URL(req.url).searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date が必要です" }, { status: 400 });
  }

  const date = parseISODateOnly(dateStr);
  const ctx = await loadSchedulingContext(date);
  const slots = buildSlotsForDay(ctx);

  const reservations = await prisma.reservation.findMany({
    where: { date: parseISODateOnly(dateStr) },
    orderBy: [{ startTime: "asc" }],
  });

  const shifts = await prisma.shift.findMany({
    where: { workDate: parseISODateOnly(dateStr) },
    include: { employee: true },
  });

  return NextResponse.json({ slots, reservations, shifts });
}
