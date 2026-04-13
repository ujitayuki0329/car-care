"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";
import {
  todayUtcIso,
  utcIsoFromYmd,
  utcMonthMeta,
  ymFromIsoDate,
  ymIsBefore,
} from "@/lib/calendar-grid";
import { parseMenuFromNotes } from "@/lib/reservation-notes";
import { SERVICE_MENU_ITEMS } from "@/lib/service-menu";
import ReservationDetailModal from "@/components/admin/ReservationDetailModal";

type DaySummary = { date: string; isOpen: boolean; hasAvailableSlot: boolean };
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
type SlotRow = {
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  available: boolean;
};
type ShiftRow = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  employee: { id: string; name: string; active: boolean };
};
type EmployeeRow = { id: string; name: string; role: string | null; active: boolean };

function normalizeBookingDate(d: unknown): string {
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export default function AdminHome() {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [days, setDays] = useState<DaySummary[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [selected, setSelected] = useState<string | null>(() => todayUtcIso());
  const [dayDetail, setDayDetail] = useState<{
    slots: SlotRow[];
    reservations: ReservationRow[];
    shifts: ShiftRow[];
  } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reservationDetail, setReservationDetail] = useState<ReservationRow | null>(null);

  const [phoneName, setPhoneName] = useState("");
  const [phoneTel, setPhoneTel] = useState("");
  const [phoneEmail, setPhoneEmail] = useState("");
  const [phoneVehicle, setPhoneVehicle] = useState("");
  const [phoneNotes, setPhoneNotes] = useState("");
  const [phoneMenu, setPhoneMenu] = useState("");
  const [phoneStart, setPhoneStart] = useState("");

  const monthRange = useMemo(() => {
    const start = utcIsoFromYmd(cursor.y, cursor.m, 1);
    const last = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const end = utcIsoFromYmd(cursor.y, cursor.m, last);
    return { start, end };
  }, [cursor]);

  const refreshMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchOpts = { credentials: "include" as RequestCredentials };
      const [calRes, resRes, empRes] = await Promise.all([
        fetch(`/api/public/calendar?year=${cursor.y}&month=${cursor.m}`),
        fetch(`/api/admin/reservations?from=${monthRange.start}&to=${monthRange.end}`, fetchOpts),
        fetch("/api/admin/employees", fetchOpts),
      ]);
      const calRaw = await safeParseJson(calRes);
      const resRaw = await safeParseJson(resRes);
      const empRaw = await safeParseJson(empRes);
      const calData = asRecord(calRaw);
      const resData = asRecord(resRaw);
      const empData = asRecord(empRaw);

      if (!calRes.ok) throw new Error(typeof calData.error === "string" ? calData.error : "カレンダー取得失敗");
      if (!resRes.ok) throw new Error(typeof resData.error === "string" ? resData.error : "予約取得失敗");
      if (!empRes.ok) throw new Error(typeof empData.error === "string" ? empData.error : "従業員取得失敗");

      setDays(Array.isArray(calData.days) ? (calData.days as DaySummary[]) : []);
      const resList = Array.isArray(resData.reservations) ? resData.reservations : [];
      setReservations(
        resList.map((r) => {
          const row = r as ReservationRow & { date: unknown };
          return { ...row, date: normalizeBookingDate(row.date) };
        }),
      );
      setEmployees(Array.isArray(empData.employees) ? (empData.employees as EmployeeRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setDays([]);
      setReservations([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [cursor, monthRange.end, monthRange.start]);

  useEffect(() => {
    void refreshMonth();
  }, [refreshMonth]);

  const todayIso = todayUtcIso();
  const earliestYm = useMemo(() => ymFromIsoDate(todayIso), [todayIso]);
  const prevYm = cursor.m > 1 ? { y: cursor.y, m: cursor.m - 1 } : { y: cursor.y - 1, m: 12 };
  const prevMonthDisabled = ymIsBefore(prevYm, earliestYm);

  useEffect(() => {
    setSelected((prev) => {
      const start = monthRange.start;
      const end = monthRange.end;
      const today = todayUtcIso();
      if (prev && prev >= start && prev <= end) return prev;
      if (today >= start && today <= end) return today;
      if (start > today) return start;
      return end;
    });
  }, [cursor.y, cursor.m, monthRange.start, monthRange.end]);

  const loadDay = useCallback(async (date: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/day?date=${encodeURIComponent(date)}`, { credentials: "include" });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "日次情報の取得失敗");
      const resv = Array.isArray(data.reservations) ? data.reservations : [];
      setDayDetail({
        slots: Array.isArray(data.slots) ? (data.slots as SlotRow[]) : [],
        reservations: resv.map((r) => {
          const row = r as ReservationRow & { date: unknown };
          return { ...row, date: normalizeBookingDate(row.date) };
        }),
        shifts: Array.isArray(data.shifts) ? (data.shifts as ShiftRow[]) : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setDayDetail({ slots: [], reservations: [], shifts: [] });
    }
  }, []);

  useEffect(() => {
    if (selected) void loadDay(selected);
  }, [selected, loadDay]);

  const resByDate = useMemo(() => {
    const m = new Map<string, ReservationRow[]>();
    for (const r of reservations) {
      const arr = m.get(r.date) ?? [];
      arr.push(r);
      m.set(r.date, arr);
    }
    return m;
  }, [reservations]);

  const { firstWeekday, lastDay } = useMemo(() => utcMonthMeta(cursor.y, cursor.m), [cursor]);
  const cells = useMemo(() => {
    const map = new Map((days ?? []).map((x) => [x.date, x]));
    const arr: { day: number; summary?: DaySummary }[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push({ day: 0 });
    for (let d = 1; d <= lastDay; d++) {
      const iso = utcIsoFromYmd(cursor.y, cursor.m, d);
      arr.push({ day: d, summary: map.get(iso) });
    }
    return arr;
  }, [cursor, days, firstWeekday, lastDay]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  };

  const postPhone = async () => {
    if (!selected || !phoneStart) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: phoneName,
          phone: phoneTel,
          email: phoneEmail || undefined,
          vehicleInfo: phoneVehicle || undefined,
          serviceMenu: phoneMenu || undefined,
          notes: phoneNotes || undefined,
          date: selected,
          startTime: phoneStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登録失敗");
      setMessage("電話予約を登録しました");
      setPhoneName("");
      setPhoneTel("");
      setPhoneEmail("");
      setPhoneVehicle("");
      setPhoneNotes("");
      setPhoneMenu("");
      setPhoneStart("");
      await refreshMonth();
      await loadDay(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const cancelReservation = async (id: string) => {
    if (!confirm("この予約をキャンセルしますか？")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失敗");
      if (selected) await loadDay(selected);
      await refreshMonth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const saveShift = async (employeeId: string, start: string, end: string) => {
    if (!selected) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/shifts", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, workDate: selected, startTime: start, endTime: end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "シフト保存失敗");
      await loadDay(selected);
      await refreshMonth();
      setMessage("シフトを保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const deleteShift = async (employeeId: string) => {
    if (!selected) return;
    if (!confirm("この日のシフトを削除しますか？")) return;
    setError(null);
    try {
      const q = new URLSearchParams({ employeeId, workDate: selected });
      const res = await fetch(`/api/admin/shifts?${q.toString()}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "削除失敗");
      await loadDay(selected);
      await refreshMonth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  return (
    <main className="surface-page">
      <header className="ui-header">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">予約・シフト</h1>
            <p className="mt-1 text-xs text-slate-600">カレンダーで受付状況を確認し、電話予約を登録できます。</p>
          </div>
          <button
            type="button"
            className="ui-btn-secondary self-start text-red-700 hover:border-red-200 hover:bg-red-50 sm:self-auto"
            onClick={() => void logout()}
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8">
        <section className="ui-card p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">稼働カレンダー</h2>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                disabled={prevMonthDisabled}
                aria-label="前の月へ"
                className="rounded-lg px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50 disabled:hover:bg-transparent"
                onClick={() => {
                  if (prevMonthDisabled) return;
                  setCursor((c) => {
                    const nm = c.m - 1;
                    return nm >= 1 ? { y: c.y, m: nm } : { y: c.y - 1, m: 12 };
                  });
                }}
              >
                ‹
              </button>
              <span className="min-w-[6.5rem] text-center text-sm font-bold tabular-nums text-slate-900">
                {cursor.y}年{cursor.m}月
              </span>
              <button
                type="button"
                className="rounded-lg px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-white hover:shadow-sm"
                onClick={() =>
                  setCursor((c) => {
                    const nm = c.m + 1;
                    return nm <= 12 ? { y: c.y, m: nm } : { y: c.y + 1, m: 1 };
                  })
                }
              >
                ›
              </button>
            </div>
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
                  const isPastDay = cellIso < todayIso;
                  const selectable = Boolean(c.summary && !isPastDay);
                  return (
                    <button
                      key={c.summary?.date ?? cellIso}
                      type="button"
                      disabled={!selectable}
                      onClick={() => selectable && c.summary && setSelected(c.summary.date)}
                      className={[
                        "min-h-[4.75rem] rounded-xl border px-1.5 py-1.5 text-left text-xs transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
                        !selectable
                          ? "cursor-not-allowed border-slate-100 bg-slate-50/90 text-slate-300"
                          : selected === c.summary?.date
                            ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/40"
                            : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={["pl-0.5 text-sm font-bold tabular-nums", selectable ? "text-slate-900" : "text-slate-400"].join(" ")}>
                          {c.day}
                        </span>
                        <span className="text-[10px] font-bold">
                          {isPastDay ? (
                            <span className="text-slate-300">—</span>
                          ) : !c.summary?.isOpen ? (
                            <span className="text-slate-400">休</span>
                          ) : c.summary.hasAvailableSlot ? (
                            <span className="text-emerald-600">○</span>
                          ) : (
                            <span className="text-amber-600">×</span>
                          )}
                        </span>
                      </div>
                      <div className={["mt-1 line-clamp-2 px-0.5 text-[10px] font-medium leading-tight", selectable ? "text-slate-600" : "text-slate-300"].join(" ")}>
                        {isPastDay
                          ? "—"
                          : (resByDate.get(c.summary?.date ?? "") ?? []).length
                            ? `${(resByDate.get(c.summary?.date ?? "") ?? []).length}件`
                            : "—"}
                      </div>
                    </button>
                  );
                })()
              ),
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            ○＝空き枠あり · ×＝満席またはシフトなし · 休＝定休・休業。今日以降の日だけ選択できます。過去の予約は「予約履歴」から参照できます。
          </p>
        </section>

        <section className="space-y-5">
          {selected ? (
            <>
              <div className="ui-card p-5 md:p-6">
                <h2 className="text-base font-bold text-slate-900">
                  時間帯の状況
                  <span className="mt-1 block font-mono text-sm font-normal text-brand-700">{selected}</span>
                </h2>
                {dayDetail ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/90">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-500">
                          <th className="px-3 py-2.5">時間</th>
                          <th className="px-3 py-2.5">予約/枠</th>
                          <th className="px-3 py-2.5">状態</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {dayDetail.slots.map((s) => (
                          <tr key={s.startTime} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold text-slate-800">
                              {s.startTime}–{s.endTime}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-slate-600">
                              <span className="font-semibold text-slate-900">{s.booked}</span>
                              <span className="text-slate-400"> / </span>
                              {s.capacity}
                            </td>
                            <td className="px-3 py-2">
                              {!s.capacity ? (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">シフトなし</span>
                              ) : s.available ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">受付可</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">満席</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">読み込み中…</p>
                )}
              </div>

              <div className="ui-card border-brand-100/80 p-5 ring-1 ring-brand-100/60 md:p-6">
                <h3 className="text-base font-bold text-slate-900">電話予約の登録</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">空き枠を確認し、開始時刻を選んで保存します。</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="ui-label text-xs">お名前</span>
                    <input className="ui-input py-2 text-sm" value={phoneName} onChange={(e) => setPhoneName(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="ui-label text-xs">電話</span>
                    <input className="ui-input py-2 text-sm" value={phoneTel} onChange={(e) => setPhoneTel(e.target.value)} inputMode="tel" />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="ui-label text-xs">開始時刻</span>
                    <select className="ui-select py-2 text-sm" value={phoneStart} onChange={(e) => setPhoneStart(e.target.value)}>
                      <option value="">空き枠から選択</option>
                      {(dayDetail?.slots ?? [])
                        .filter((s) => s.available)
                        .map((s) => (
                          <option key={s.startTime} value={s.startTime}>
                            {s.startTime}（残り {s.capacity - s.booked}）
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="ui-label text-xs">メール（任意）</span>
                    <input type="email" className="ui-input py-2 text-sm" value={phoneEmail} onChange={(e) => setPhoneEmail(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="ui-label text-xs">ご希望メニュー（任意）</span>
                    <select className="ui-select py-2 text-sm" value={phoneMenu} onChange={(e) => setPhoneMenu(e.target.value)}>
                      <option value="">選択しない</option>
                      {SERVICE_MENU_ITEMS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="ui-label text-xs">車両・用件（任意）</span>
                    <input className="ui-input py-2 text-sm" value={phoneVehicle} onChange={(e) => setPhoneVehicle(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="ui-label text-xs">メモ（任意）</span>
                    <input className="ui-input py-2 text-sm" value={phoneNotes} onChange={(e) => setPhoneNotes(e.target.value)} />
                  </label>
                </div>
                <button
                  type="button"
                  className="ui-btn-primary mt-4 w-full sm:w-auto"
                  disabled={!phoneName || phoneTel.length < 10 || !phoneStart}
                  onClick={() => void postPhone()}
                >
                  電話予約を保存
                </button>
              </div>

              <div className="ui-card p-5 md:p-6">
                <h3 className="text-base font-bold text-slate-900">この日の予約</h3>
                <p className="mt-1 text-xs text-slate-500">行を押すと、メニュー・車両・メモなどの詳細を表示します。</p>
                <ul className="mt-4 space-y-2.5">
                  {(dayDetail?.reservations ?? []).map((r) => {
                    const menuLabel = parseMenuFromNotes(r.notes);
                    return (
                      <li
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-left transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                        onClick={() => setReservationDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setReservationDetail(r);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-slate-900">
                              {r.startTime}–{r.endTime}
                            </span>
                            <span className="truncate font-semibold text-slate-900">{r.customerName}</span>
                            {menuLabel ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">{menuLabel}</span>
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
                        {r.status === "CONFIRMED" ? (
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              void cancelReservation(r.id);
                            }}
                          >
                            キャンセル
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                  {!(dayDetail?.reservations ?? []).length ? (
                    <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">この日の予約はありません</li>
                  ) : null}
                </ul>
              </div>

              <div className="ui-card p-5 md:p-6">
                <h3 className="text-base font-bold text-slate-900">従業員シフト</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  <span className="font-mono font-medium text-brand-800">{selected}</span>
                  の出勤枠が予約キャパの上限になります。
                </p>
                <ul className="mt-4 space-y-3">
                  {employees.map((emp) => {
                    const existing = dayDetail?.shifts.find((s) => s.employeeId === emp.id);
                    return (
                      <ShiftEditorRow
                        key={emp.id}
                        name={emp.name}
                        initialStart={existing?.startTime ?? "09:00"}
                        initialEnd={existing?.endTime ?? "18:00"}
                        hasShift={Boolean(existing)}
                        onSave={(st, en) => void saveShift(emp.id, st, en)}
                        onDelete={() => void deleteShift(emp.id)}
                        disabled={!emp.active}
                      />
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <div className="ui-card flex flex-col items-center justify-center border-dashed py-14 text-center">
              <p className="text-sm font-medium text-slate-700">表示する日付がありません</p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">
                カレンダーで今日以降の日付を選ぶと、枠・電話予約・シフトが表示されます。
              </p>
            </div>
          )}
        </section>
      </div>
      </div>

      <ReservationDetailModal reservation={reservationDetail} onClose={() => setReservationDetail(null)} />
    </main>
  );
}

function ShiftEditorRow({
  name,
  initialStart,
  initialEnd,
  hasShift,
  onSave,
  onDelete,
  disabled,
}: {
  name: string;
  initialStart: string;
  initialEnd: string;
  hasShift: boolean;
  onSave: (s: string, e: string) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [st, setSt] = useState(initialStart);
  const [en, setEn] = useState(initialEnd);

  useEffect(() => {
    setSt(initialStart);
    setEn(initialEnd);
  }, [initialStart, initialEnd]);

  if (disabled) {
    return (
      <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
        {name}（無効）
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{name}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="time"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-mono shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          value={st}
          onChange={(e) => setSt(e.target.value.slice(0, 5))}
        />
        <span className="text-xs font-medium text-slate-400">〜</span>
        <input
          type="time"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-mono shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          value={en}
          onChange={(e) => setEn(e.target.value.slice(0, 5))}
        />
        <button type="button" className="ui-btn-primary px-4 py-2 text-xs" onClick={() => onSave(st, en)}>
          保存
        </button>
        {hasShift ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
            onClick={onDelete}
          >
            削除
          </button>
        ) : null}
      </div>
    </li>
  );
}
