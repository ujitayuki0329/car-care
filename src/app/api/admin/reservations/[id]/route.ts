import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/api-admin";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
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
    const row = await prisma.reservation.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json({ reservation: row });
  } catch {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
}
