import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveScheduleDefaults } from "@/lib/business-schedule-defaults";
import { assertSlotStillAvailable } from "@/lib/slots";
import { addMinutesToTime, parseISODateOnly } from "@/lib/time";
import { buildNotesWithMenu } from "@/lib/reservation-notes";
import { isServiceMenu } from "@/lib/service-menu";

const bodySchema = z.object({
  customerName: z.string().min(1).max(120),
  phone: z.string().min(10).max(24),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  vehicleInfo: z.string().max(800).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  serviceMenu: z.string().optional().refine((s) => s === undefined || s === "" || isServiceMenu(s)),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
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
            source: "WEB",
            status: "CONFIRMED",
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

    return NextResponse.json({ id: created.id });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_UNAVAILABLE") {
      return NextResponse.json({ error: "この枠は現在埋まっています" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
