"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";
import { todayUtcIso, utcIsoFromYmd, utcMonthMeta } from "@/lib/calendar-grid";

type EmployeeRow = { id: string; name: string; role: string | null; active: boolean };
type ShiftRow = {
  id: string;
  employeeId: string;
  workDate: unknown;
  startTime: string;
  endTime: string;
  employee: { id: string; name: string; active: boolean };
};

const fetchOpts: RequestInit = { credentials: "include" };
const WD_HEADERS = ["日", "月", "火", "水", "木", "金", "土"];

function workDateIso(d: unknown): string {
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export default function ShiftsPage() {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addEmpId, setAddEmpId] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addStart, setAddStart] = useState("09:00");
  const [addEnd, setAddEnd] = useState("18:00");

  const monthRange = useMemo(() => {
    const { lastDay } = utcMonthMeta(cursor.y, cursor.m);
    return { from: utcIsoFromYmd(cursor.y, cursor.m, 1), to: utcIsoFromYmd(cursor.y, cursor.m, lastDay) };
  }, [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = `from=${monthRange.from}&to=${monthRange.to}`;
      const [empRes, shRes] = await Promise.all([
        fetch("/api/admin/employees", fetchOpts),
        fetch(`/api/admin/shifts?${q}`, fetchOpts),
      ]);
      const empRaw = await safeParseJson(empRes);
      const shRaw = await safeParseJson(shRes);
      const empData = asRecord(empRaw);
      const shData = asRecord(shRaw);
      if (!empRes.ok) throw new Error(typeof empData.error === "string" ? empData.error : "従業員取得失敗");
      if (!shRes.ok) throw new Error(typeof shData.error === "string" ? shData.error : "シフト取得失敗");
      setEmployees(Array.isArray(empData.employees) ? (empData.employees as EmployeeRow[]) : []);
      setShifts(Array.isArray(shData.shifts) ? (shData.shifts as ShiftRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setEmployees([]);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [monthRange.from, monthRange.to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const active = employees.filter((e) => e.active);
    if (active.length && !addEmpId) setAddEmpId(active[0].id);
  }, [employees, addEmpId]);

  useEffect(() => {
    setSelectedDate(null);
    setAddDate("");
  }, [cursor.y, cursor.m]);

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const da = workDateIso(a.workDate);
      const db = workDateIso(b.workDate);
      if (da !== db) return da.localeCompare(db);
      return a.employee.name.localeCompare(b.employee.name, "ja");
    });
  }, [shifts]);

  const countByDate = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of shifts) {
      const wd = workDateIso(s.workDate);
      if (!wd) continue;
      const set = m.get(wd) ?? new Set<string>();
      set.add(s.employeeId);
      m.set(wd, set);
    }
    const out = new Map<string, number>();
    for (const [k, set] of Array.from(m.entries())) out.set(k, set.size);
    return out;
  }, [shifts]);

  const { firstWeekday, lastDay } = useMemo(() => utcMonthMeta(cursor.y, cursor.m), [cursor]);
  const calendarCells = useMemo(() => {
    const arr: { day: number; dateIso: string | null; count: number }[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push({ day: 0, dateIso: null, count: 0 });
    for (let d = 1; d <= lastDay; d++) {
      const iso = utcIsoFromYmd(cursor.y, cursor.m, d);
      arr.push({ day: d, dateIso: iso, count: countByDate.get(iso) ?? 0 });
    }
    return arr;
  }, [cursor.y, cursor.m, firstWeekday, lastDay, countByDate]);

  const todayIso = todayUtcIso();

  const dayShifts = useMemo(() => {
    if (!selectedDate) return [];
    return sortedShifts.filter((s) => workDateIso(s.workDate) === selectedDate);
  }, [sortedShifts, selectedDate]);

  const pickDate = (iso: string) => {
    setSelectedDate(iso);
    setAddDate(iso);
  };

  const saveShift = async (employeeId: string, workDate: string, startTime: string, endTime: string) => {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/shifts", {
        ...fetchOpts,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, workDate, startTime, endTime }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "保存失敗");
      setMessage("シフトを保存しました");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const deleteShift = async (employeeId: string, workDate: string) => {
    if (!confirm("このシフトを削除しますか？")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/shifts?employeeId=${encodeURIComponent(employeeId)}&workDate=${encodeURIComponent(workDate)}`,
        { ...fetchOpts, method: "DELETE" },
      );
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "削除失敗");
      setMessage("削除しました");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  return (
    <main className="surface-page">
      <header className="ui-header">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">シフト管理</h1>
          <p className="mt-1 text-xs text-slate-600">カレンダーで出勤人数を把握し、日付を選んで編集できます。</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
          <div className="space-y-6">
            <div className="ui-card p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">月間シフト</h2>
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
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
                  <span className="min-w-[6.5rem] text-center text-sm font-bold tabular-nums">{cursor.y}年{cursor.m}月</span>
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
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
              <p className="mb-3 text-xs text-slate-500">{loading ? "読み込み中…" : "各日の出勤人数（整備士のユニーク数）です。"}</p>
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-500">
                {WD_HEADERS.map((w, wi) => (
                  <div key={w} className={wi === 0 || wi === 6 ? "text-rose-500/90" : ""}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((c, idx) =>
                  c.day === 0 || !c.dateIso ? (
                    <div key={`e-${idx}`} />
                  ) : (
                    <button
                      key={c.dateIso}
                      type="button"
                      onClick={() => pickDate(c.dateIso!)}
                      className={[
                        "flex min-h-[4.5rem] flex-col rounded-xl border px-1.5 py-1.5 text-left text-xs transition",
                        selectedDate === c.dateIso
                          ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/40"
                          : c.dateIso === todayIso
                            ? "border-slate-300 bg-white ring-1 ring-brand-500/30 hover:shadow-sm"
                            : "border-slate-200/90 bg-white hover:shadow-sm",
                      ].join(" ")}
                    >
                      <span className="text-sm font-bold tabular-nums text-slate-900">{c.day}</span>
                      <div className="mt-auto pt-1">
                        {c.count > 0 ? (
                          <span className="inline-flex rounded-full bg-brand-600/10 px-2 py-0.5 text-[11px] font-bold text-brand-800">
                            {c.count}名
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="ui-card p-5 md:p-6">
              <h2 className="text-base font-bold text-slate-900">シフトを追加</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">整備士</span>
                  <select className="ui-select py-2 text-sm" value={addEmpId} onChange={(e) => setAddEmpId(e.target.value)}>
                    {employees
                      .filter((e) => e.active)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">日付</span>
                  <input type="date" className="ui-input py-2 text-sm" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
                </label>
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">開始</span>
                  <input type="time" className="ui-input py-2 font-mono text-sm" value={addStart} onChange={(e) => setAddStart(e.target.value.slice(0, 5))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">終了</span>
                  <input type="time" className="ui-input py-2 font-mono text-sm" value={addEnd} onChange={(e) => setAddEnd(e.target.value.slice(0, 5))} />
                </label>
              </div>
              <button
                type="button"
                className="ui-btn-primary mt-4"
                disabled={!addEmpId || !addDate}
                onClick={() => void saveShift(addEmpId, addDate, addStart, addEnd)}
              >
                追加・更新
              </button>
            </div>
          </div>

          <div className="ui-card overflow-hidden p-0 lg:sticky lg:top-6">
            <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3">
              <h2 className="text-base font-bold text-slate-900">選択日のシフト</h2>
              {selectedDate ? (
                <p className="mt-1 font-mono text-sm font-semibold text-brand-800">{selectedDate}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">カレンダーで日付を選んでください。</p>
              )}
            </div>
            {!selectedDate ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">未選択です。</p>
            ) : loading ? (
              <p className="px-5 py-10 text-sm text-slate-500">読み込み中…</p>
            ) : dayShifts.length === 0 ? (
              <p className="px-5 py-10 text-sm text-slate-500">この日のシフトはありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-xs font-bold text-slate-500">
                      <th className="px-4 py-3">整備士</th>
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayShifts.map((s) => {
                      const wd = workDateIso(s.workDate);
                      return (
                        <ShiftEditRow
                          key={s.id}
                          employeeName={s.employee.name}
                          workDate={wd}
                          start={s.startTime}
                          end={s.endTime}
                          onSave={(st, en) => void saveShift(s.employeeId, wd, st, en)}
                          onDelete={() => void deleteShift(s.employeeId, wd)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ShiftEditRow({
  employeeName,
  workDate,
  start,
  end,
  onSave,
  onDelete,
}: {
  employeeName: string;
  workDate: string;
  start: string;
  end: string;
  onSave: (s: string, e: string) => void;
  onDelete: () => void;
}) {
  const [st, setSt] = useState(start);
  const [en, setEn] = useState(end);
  useEffect(() => {
    setSt(start);
    setEn(end);
  }, [start, end, workDate]);

  return (
    <tr className="bg-white hover:bg-slate-50/80">
      <td className="px-4 py-3 font-medium text-slate-900">{employeeName}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="time" className="rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs" value={st} onChange={(e) => setSt(e.target.value.slice(0, 5))} />
          <span className="text-slate-400">〜</span>
          <input type="time" className="rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs" value={en} onChange={(e) => setEn(e.target.value.slice(0, 5))} />
          <button type="button" className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => onSave(st, en)}>
            保存
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={onDelete}>
          削除
        </button>
      </td>
    </tr>
  );
}
