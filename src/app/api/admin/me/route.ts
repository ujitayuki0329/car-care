import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/api-admin";

export async function GET() {
  const gate = await requireAdminResponse();
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ email: gate.email, id: gate.id });
}
