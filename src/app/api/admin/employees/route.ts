import { NextResponse } from "next/server";
import { z } from "zod";
import { todayUtcIso } from "@/lib/calendar-grid";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";
import { formatISODate, parseISODateOnly, timeToMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weeklyShiftSeedSchema = z.object({
  /** 0=日 … 6=土（UTC・カレンダー画面と同じ） */
  weekdays: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  weeksAhead: z.number().int().min(1).max(52).optional(),
});

const postSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  active: z.boolean().optional(),
  weeklyShiftSeed: weeklyShiftSeedSchema.optional(),
});

function addDaysUtc(isoYmd: string, deltaDays: number): string {
  const d = parseISODateOnly(isoYmd);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatISODate(d);
}

export async function GET() {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ employees });
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

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const seed = parsed.data.weeklyShiftSeed;
  if (seed?.weekdays?.length) {
    if (timeToMinutes(seed.endTime) <= timeToMinutes(seed.startTime)) {
      return NextResponse.json({ error: "終了時間は開始時間より後である必要があります" }, { status: 400 });
    }
  }

  const weeksAhead = seed?.weeksAhead ?? 12;
  const weekdaySet = seed?.weekdays?.length ? new Set(seed.weekdays) : null;

  const { employee, shiftCount } = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role ?? null,
        notes: parsed.data.notes ?? null,
        active: parsed.data.active ?? true,
      },
    });

    if (!weekdaySet?.size || !seed) {
      return { employee: created, shiftCount: 0 };
    }

    const start = todayUtcIso();
    const rows: { employeeId: string; workDate: Date; startTime: string; endTime: string }[] = [];
    for (let i = 0; i < weeksAhead * 7; i++) {
      const iso = addDaysUtc(start, i);
      const wd = parseISODateOnly(iso).getUTCDay();
      if (weekdaySet.has(wd)) {
        rows.push({
          employeeId: created.id,
          workDate: parseISODateOnly(iso),
          startTime: seed.startTime,
          endTime: seed.endTime,
        });
      }
    }

    if (rows.length) {
      await tx.shift.createMany({ data: rows });
    }
    return { employee: created, shiftCount: rows.length };
  });

  return NextResponse.json({ employee, shiftCount });
}
