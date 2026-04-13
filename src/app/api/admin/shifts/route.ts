import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";
import { parseISODateOnly } from "@/lib/time";

const putSchema = z.object({
  employeeId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
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

  const shifts = await prisma.shift.findMany({
    where: { workDate: { gte: fromD, lte: toD } },
    include: { employee: true },
    orderBy: [{ workDate: "asc" }, { employee: { name: "asc" } }],
  });

  return NextResponse.json({ shifts });
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

  const workDate = parseISODateOnly(parsed.data.workDate);

  const shift = await prisma.shift.upsert({
    where: {
      employeeId_workDate: { employeeId: parsed.data.employeeId, workDate },
    },
    create: {
      employeeId: parsed.data.employeeId,
      workDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    },
    update: {
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    },
    include: { employee: true },
  });

  return NextResponse.json({ shift });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const workDateStr = searchParams.get("workDate");
  if (!employeeId || !workDateStr) {
    return NextResponse.json({ error: "employeeId, workDate が必要です" }, { status: 400 });
  }

  const workDate = parseISODateOnly(workDateStr);
  await prisma.shift.deleteMany({ where: { employeeId, workDate } });
  return NextResponse.json({ ok: true });
}
