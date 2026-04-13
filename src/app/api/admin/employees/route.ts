import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

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

  const created = await prisma.employee.create({
    data: {
      name: parsed.data.name,
      role: parsed.data.role ?? null,
      notes: parsed.data.notes ?? null,
      active: parsed.data.active ?? true,
    },
  });

  return NextResponse.json({ employee: created });
}
