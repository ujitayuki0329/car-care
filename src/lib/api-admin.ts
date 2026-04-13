import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName, verifyAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AdminGate =
  | { ok: true; id: string; email: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGate> {
  const token = cookies().get(getSessionCookieName())?.value;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  }
  const v = await verifyAdminSession(token);
  if (!v) {
    return { ok: false, response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  }
  const acc = await prisma.adminAccount.findFirst({
    where: { id: v.sub, active: true },
  });
  if (!acc) {
    return { ok: false, response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  }
  return { ok: true, id: acc.id, email: acc.email };
}

export async function requireAdminResponse(): Promise<{ id: string; email: string } | NextResponse> {
  const g = await requireAdmin();
  if (!g.ok) return g.response;
  return { id: g.id, email: g.email };
}
