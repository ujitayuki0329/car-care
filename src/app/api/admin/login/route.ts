import { NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { signAdminSession, getSessionCookieName, MAX_AGE_SEC } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が必要です" }, { status: 400 });
  }
  const body = json as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "メールとパスワードが必要です" }, { status: 400 });
  }

  const acc = await prisma.adminAccount.findUnique({ where: { email } });
  if (!acc?.active) {
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, acc.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 401 });
  }

  const token = await signAdminSession({ sub: acc.id, email: acc.email });
  const res = NextResponse.json({ ok: true, email: acc.email });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return res;
}
