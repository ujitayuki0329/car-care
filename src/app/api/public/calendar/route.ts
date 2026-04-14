import { NextRequest, NextResponse } from "next/server";
import { getMonthAvailability } from "@/lib/slots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const y = parseInt(searchParams.get("year") ?? "", 10);
  const m = parseInt(searchParams.get("month") ?? "", 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "year と month が必要です" }, { status: 400 });
  }

  const days = await getMonthAvailability(y, m);
  return NextResponse.json({ days });
}
