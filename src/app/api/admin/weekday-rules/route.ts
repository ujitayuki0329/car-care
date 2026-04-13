import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
});

export async function PATCH(req: Request) {
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

  const row = await prisma.weekdayRule.upsert({
    where: { weekday: parsed.data.weekday },
    create: { weekday: parsed.data.weekday, isClosed: parsed.data.isClosed },
    update: { isClosed: parsed.data.isClosed },
  });

  return NextResponse.json({ rule: row });
}
