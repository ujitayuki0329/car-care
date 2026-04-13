import { NextRequest, NextResponse } from "next/server";
import { buildSlotsForDay, loadSchedulingContext } from "@/lib/slots";
import { parseISODateOnly } from "@/lib/time";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) が必要です" }, { status: 400 });
  }

  const date = parseISODateOnly(dateStr);
  const ctx = await loadSchedulingContext(date);
  const slots = buildSlotsForDay(ctx);
  return NextResponse.json({ slots });
}
