import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";
import { parseISODateOnly } from "@/lib/time";

const putSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  memo: z.string().max(500).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from, to が必要です" }, { status: 400 });
  }

  const fromD = parseISODateOnly(from);
  const toD = parseISODateOnly(to);

  const rows = await prisma.businessDayOverride.findMany({
    where: { date: { gte: fromD, lte: toD } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ overrides: rows });
}

export async function PUT(req: Request) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const day = parseISODateOnly(parsed.data.date);

  const row = await prisma.businessDayOverride.upsert({
    where: { date: day },
    create: {
      date: day,
      isClosed: parsed.data.isClosed,
      openTime: parsed.data.isClosed ? null : parsed.data.openTime,
      closeTime: parsed.data.isClosed ? null : parsed.data.closeTime,
      memo: parsed.data.memo ?? null,
    },
    update: {
      isClosed: parsed.data.isClosed,
      openTime: parsed.data.isClosed ? null : parsed.data.openTime,
      closeTime: parsed.data.isClosed ? null : parsed.data.closeTime,
      memo: parsed.data.memo ?? null,
    },
  });

  return NextResponse.json({ override: row });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const dateStr = new URL(req.url).searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date が必要です" }, { status: 400 });
  }

  const day = parseISODateOnly(dateStr);
  await prisma.businessDayOverride.deleteMany({ where: { date: day } });
  return NextResponse.json({ ok: true });
}
