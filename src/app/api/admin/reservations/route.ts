import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";
import { assertSlotStillAvailable } from "@/lib/slots";
import { addMinutesToTime, parseISODateOnly } from "@/lib/time";
import { resolveScheduleDefaults } from "@/lib/business-schedule-defaults";
import { buildNotesWithMenu } from "@/lib/reservation-notes";
import { isServiceMenu } from "@/lib/service-menu";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  customerName: z.string().min(1).max(120),
  phone: z.string().min(10).max(24),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  vehicleInfo: z.string().max(800).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  serviceMenu: z.string().optional().refine((s) => s === undefined || s === "" || isServiceMenu(s)),
  notes: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from, to (YYYY-MM-DD) が必要です" }, { status: 400 });
  }

  const fromD = parseISODateOnly(from);
  const toD = parseISODateOnly(to);

  const rows = await prisma.reservation.findMany({
    where: { date: { gte: fromD, lte: toD } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ reservations: rows });
}

export async function POST(req: Request) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です", details: parsed.error.flatten() }, { status: 400 });
  }

  const date = parseISODateOnly(parsed.data.date);
  const menu = parsed.data.serviceMenu?.trim();
  const notesCombined =
    menu && isServiceMenu(menu)
      ? buildNotesWithMenu(menu, parsed.data.notes ?? null)
      : parsed.data.notes?.trim() || null;

  try {
    const { reservationMinutes } = await resolveScheduleDefaults(prisma);
    const endTime = addMinutesToTime(parsed.data.startTime, reservationMinutes);

    const created = await prisma.$transaction(
      async (tx) => {
        await assertSlotStillAvailable(tx, date, parsed.data.startTime, endTime);
        return tx.reservation.create({
          data: {
            customerName: parsed.data.customerName,
            phone: parsed.data.phone,
            email: parsed.data.email || null,
            vehicleInfo: parsed.data.vehicleInfo ?? null,
            notes: notesCombined,
            date,
            startTime: parsed.data.startTime,
            endTime,
            source: "PHONE",
            status: "CONFIRMED",
            createdByAdminId: gate.id,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    return NextResponse.json({ reservation: created });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_UNAVAILABLE") {
      return NextResponse.json({ error: "この枠は現在埋まっています" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
