import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  try {
    const updated = await prisma.employee.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ employee: updated });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;

  try {
    await prisma.employee.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "従業員が見つからないか、削除できませんでした" }, { status: 404 });
  }
}
