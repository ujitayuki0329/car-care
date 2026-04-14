"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";
import { parseMenuFromNotes } from "@/lib/reservation-notes";
import { utcIsoFromYmd, utcMonthMeta } from "@/lib/calendar-grid";
import ReservationDetailModal from "@/components/admin/ReservationDetailModal";

type ReservationRow = {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  vehicleInfo: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  notes: string | null;
  createdAt?: string | null;
};

const fetchOpts: RequestInit = { credentials: "include", cache: "no-store" };

function normalizeBookingDate(d: unknown): string {
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export default function ReservationHistoryPage() {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReservationRow | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthRange = useMemo(() => {
    const { lastDay } = utcMonthMeta(cursor.y, cursor.m);
    return { from: utcIsoFromYmd(cursor.y, cursor.m, 1), to: utcIsoFromYmd(cursor.y, cursor.m, lastDay) };
  }, [cursor]);

  const { firstWeekday, lastDay } = useMemo(() => utcMonthMeta(cursor.y, cursor.m), [cursor]);

  const cells = useMemo(() => {
    const arr: { day: number }[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push({ day: 0 });
    for (let d = 1; d <= lastDay; d++) arr.push({ day: d });
    return arr;
  }, [firstWeekday, lastDay]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reservations?from=${monthRange.from}&to=${monthRange.to}`, fetchOpts);
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "取得に失敗しました");
      const list = Array.isArray(data.reservations) ? data.reservations : [];
      setRows(
        list.map((r) => {
          const row = r as ReservationRow & { date: unknown };
          return { ...row, date: normalizeBookingDate(row.date) };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [monthRange.from, monthRange.to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedDate(null);
    setDetail(null);
  }, [cursor.y, cursor.m]);

  const resByDate = useMemo(() => {
    const m = new Map<string, ReservationRow[]>();
    for (const r of rows) {
      const k = r.date;
      if (!k) continue;
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [rows]);

  const monthTotal = rows.length;

  const selectedDayReservations = selectedDate ? (resByDate.get(selectedDate) ?? []) : [];

  const onDayClick = (iso: string) => {
    setSelectedDate((prev) => (prev === iso ? null : iso));
    setDetail(null);
  };

  return (
    <main className="surface-page flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="ui-header shrink-0">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">予約履歴</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">
            左のカレンダーで日付を選ぶと、右にその日の予約一覧が表示されます。一覧から行をタップすると詳細を開けます。
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl min-h-0 w-full flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* 左：月操作 + カレンダー */}
          <div className="min-w-0 w-full shrink-0 lg:max-w-md xl:max-w-lg">
            <section className="ui-card p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                    onClick={() =>
                      setCursor((c) => {
                        const nm = c.m - 1;
                        if (nm >= 1) return { y: c.y, m: nm };
                        return { y: c.y - 1, m: 12 };
                      })
                    }
                  >
                    ‹
                  </button>
                  <span className="min-w-[7rem] text-center text-sm font-bold tabular-nums">
                    {cursor.y}年{cursor.m}月
                  </span>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                    onClick={() =>
                      setCursor((c) => {
                        const nm = c.m + 1;
                        if (nm <= 12) return { y: c.y, m: nm };
                        return { y: c.y + 1, m: 1 };
                      })
                    }
                  >
                    ›
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  今月の予約{" "}
                  <span className="font-semibold tabular-nums text-slate-900">{loading ? "…" : monthTotal}</span> 件
                </p>
              </div>

              <div className="mb-4 border-t border-slate-100 pt-4">
                <h2 className="text-base font-bold text-slate-900">カレンダー</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  バッジは件数です。同じ日をもう一度タップで選択解除。
                </p>
              </div>
              <p className="mb-3 text-xs text-slate-500">{loading ? "読み込み中…" : ""}</p>

              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-500">
                {["日", "月", "火", "水", "木", "金", "土"].map((w, wi) => (
                  <div key={w} className={wi === 0 || wi === 6 ? "text-rose-500/90" : ""}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((c, idx) =>
                  c.day === 0 ? (
                    <div key={`e-${idx}`} />
                  ) : (
                    (() => {
                      const cellIso = utcIsoFromYmd(cursor.y, cursor.m, c.day);
                      const count = resByDate.get(cellIso)?.length ?? 0;
                      const selected = selectedDate === cellIso;
                      return (
                        <button
                          key={cellIso}
                          type="button"
                          onClick={() => onDayClick(cellIso)}
                          className={[
                            "min-h-[4rem] rounded-xl border px-1 py-1.5 text-left text-xs transition sm:min-h-[4.25rem]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
                            selected
                              ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/35"
                              : count > 0
                                ? "border-slate-200/90 bg-white hover:border-brand-300 hover:shadow-sm"
                                : "border-slate-100 bg-slate-50/80 text-slate-400 hover:border-slate-200 hover:bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-0.5">
                            <span
                              className={[
                                "pl-0.5 text-sm font-bold tabular-nums",
                                count > 0 || selected ? "text-slate-900" : "text-slate-400",
                              ].join(" ")}
                            >
                              {c.day}
                            </span>
                            {count > 0 ? (
                              <span className="rounded-full bg-brand-100 px-1 py-0.5 text-[9px] font-bold text-brand-900 sm:text-[10px]">
                                {count}件
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-slate-300 sm:text-[10px]">—</span>
                            )}
                          </div>
                        </button>
                      );
                    })()
                  )
                )}
              </div>
            </section>
          </div>

          {/* 右：選択日の一覧 */}
          <div className="min-w-0 flex-1 lg:min-w-[20rem]">
            <section
              className={[
                "ui-card flex flex-col p-5 md:p-6",
                "lg:sticky lg:top-4 lg:max-h-[calc(100vh-5.5rem)]",
              ].join(" ")}
            >
              {selectedDate ? (
                <>
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        <span className="font-mono text-sm font-semibold text-brand-800">{selectedDate}</span>
                        <span className="mt-1 block text-slate-900">この日の予約</span>
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{selectedDayReservations.length} 件</p>
                    </div>
                    <button type="button" className="ui-btn-secondary text-xs" onClick={() => setSelectedDate(null)}>
                      選択を解除
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pt-4 [-ms-overflow-style:none] [scrollbar-width:thin]">
                    {selectedDayReservations.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                        この日の予約はありません。
                      </p>
                    ) : (
                      <ul className="space-y-2.5 pr-1">
                        {selectedDayReservations.map((r) => {
                          const menuLabel = parseMenuFromNotes(r.notes);
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-left transition hover:border-brand-200 hover:bg-white hover:shadow-sm"
                                onClick={() => setDetail(r)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-slate-900">
                                      {r.startTime}–{r.endTime}
                                    </span>
                                    <span className="truncate font-semibold text-slate-900">{r.customerName}</span>
                                    {menuLabel ? (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                        {menuLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                    <span className="font-mono">{r.phone}</span>
                                    <span
                                      className={
                                        r.source === "PHONE"
                                          ? "rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800"
                                          : "rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                                      }
                                    >
                                      {r.source === "PHONE" ? "電話" : "Web"}
                                    </span>
                                    <span
                                      className={
                                        r.status === "CONFIRMED"
                                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                                          : r.status === "CANCELLED"
                                            ? "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800"
                                            : "rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                                      }
                                    >
                                      {r.status}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold text-brand-700">詳細</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500"
                    aria-hidden
                  >
                    📅
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">日付を選択してください</p>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                    左のカレンダーで日をタップすると、ここにその日の予約一覧が表示されます。行をタップで詳細モーダルが開きます。
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <ReservationDetailModal reservation={detail} onClose={() => setDetail(null)} />
      </div>
    </main>
  );
}
