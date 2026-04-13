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

const fetchOpts: RequestInit = { credentials: "include" };

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

  const monthRange = useMemo(() => {
    const { lastDay } = utcMonthMeta(cursor.y, cursor.m);
    return { from: utcIsoFromYmd(cursor.y, cursor.m, 1), to: utcIsoFromYmd(cursor.y, cursor.m, lastDay) };
  }, [cursor]);

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

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.startTime.localeCompare(a.startTime);
    });
  }, [rows]);

  return (
    <main className="surface-page">
      <header className="ui-header">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">予約履歴</h1>
          <p className="mt-1 text-xs text-slate-600">月ごとの予約一覧です。行を押すと詳細を表示します。</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
        <div className="ui-card flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
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
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
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
        </div>
        <div className="ui-card overflow-hidden p-0 md:p-0">
          <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3">
            <h2 className="text-base font-bold text-slate-900">一覧</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {monthRange.from} 〜 {monthRange.to} · {sorted.length} 件
            </p>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-sm text-slate-500">読み込み中…</p>
          ) : sorted.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500">この月の予約はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-bold text-slate-500">
                    <th className="px-4 py-3">日付</th>
                    <th className="px-4 py-3">時間</th>
                    <th className="px-4 py-3">お名前</th>
                    <th className="px-4 py-3">電話</th>
                    <th className="px-4 py-3">メニュー</th>
                    <th className="px-4 py-3">経路</th>
                    <th className="px-4 py-3">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((r) => {
                    const menu = parseMenuFromNotes(r.notes);
                    return (
                      <tr
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer bg-white hover:bg-brand-50/60"
                        onClick={() => setDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetail(r);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">{r.date}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                          {r.startTime}–{r.endTime}
                        </td>
                        <td className="max-w-[12rem] truncate px-4 py-3 font-medium">{r.customerName}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{r.phone}</td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-xs">{menu ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              r.source === "PHONE"
                                ? "rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800"
                                : "rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                            }
                          >
                            {r.source === "PHONE" ? "電話" : "Web"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <ReservationDetailModal reservation={detail} onClose={() => setDetail(null)} />
      </div>
    </main>
  );
}
