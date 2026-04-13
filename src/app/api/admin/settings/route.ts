import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";
import { resolveScheduleDefaults, SETTINGS_ID } from "@/lib/business-schedule-defaults";
import { getEnvScheduleDefaults } from "@/lib/config";

const patchScheduleSchema = z.object({
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.number().int().min(5).max(240),
  reservationMinutes: z.number().int().min(15).max(480),
});

export async function GET() {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const row = await prisma.businessSettings.findUnique({ where: { id: SETTINGS_ID } });
  const defs = await resolveScheduleDefaults(prisma);
  const weekdayRules = await prisma.weekdayRule.findMany({ orderBy: { weekday: "asc" } });

  return NextResponse.json({
    defaults: {
      openTime: defs.openTime,
      closeTime: defs.closeTime,
      slotMinutes: defs.slotMinutes,
      reservationMinutes: defs.reservationMinutes,
    },
    scheduleStoredInDb: Boolean(row),
    envFallback: getEnvScheduleDefaults(),
    weekdayRules,
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }

  const parsed = patchScheduleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const openM =
    parseInt(parsed.data.openTime.slice(0, 2), 10) * 60 + parseInt(parsed.data.openTime.slice(3, 5), 10);
  const closeM =
    parseInt(parsed.data.closeTime.slice(0, 2), 10) * 60 + parseInt(parsed.data.closeTime.slice(3, 5), 10);
  if (openM >= closeM) {
    return NextResponse.json({ error: "閉店時刻は開店時刻より後にしてください" }, { status: 400 });
  }
  if (parsed.data.reservationMinutes > closeM - openM) {
    return NextResponse.json({ error: "1件の予約時間が営業時間内に収まるよう調整してください" }, { status: 400 });
  }

  const saved = await prisma.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      openTime: parsed.data.openTime,
      closeTime: parsed.data.closeTime,
      slotMinutes: parsed.data.slotMinutes,
      reservationMinutes: parsed.data.reservationMinutes,
    },
    update: {
      openTime: parsed.data.openTime,
      closeTime: parsed.data.closeTime,
      slotMinutes: parsed.data.slotMinutes,
      reservationMinutes: parsed.data.reservationMinutes,
    },
  });

  return NextResponse.json({
    defaults: {
      openTime: saved.openTime,
      closeTime: saved.closeTime,
      slotMinutes: saved.slotMinutes,
      reservationMinutes: saved.reservationMinutes,
    },
    scheduleStoredInDb: true,
  });
}
