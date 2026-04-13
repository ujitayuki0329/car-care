"use client";

import { useCallback, useEffect, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";

type Employee = { id: string; name: string; role: string | null; active: boolean; notes: string | null };

const fetchOpts: RequestInit = { credentials: "include" };

/** 表示順: 月〜日（値は getUTCDay: 日=0 … 土=6） */
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 0, label: "日" },
];

const DEFAULT_WEEKDAYS = new Set([1, 2, 3, 4, 5]);

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [shiftWeekdays, setShiftWeekdays] = useState<Set<number>>(() => new Set(DEFAULT_WEEKDAYS));
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [weeksAhead, setWeeksAhead] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/employees", fetchOpts);
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "取得失敗");
      setRows(Array.isArray(data.employees) ? (data.employees as Employee[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWeekday = (v: number) => {
    setShiftWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const toggleActive = async (id: string, active: boolean) => {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        ...fetchOpts,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "更新失敗");
      setMessage("更新しました");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const addEmployee = async () => {
    if (!name.trim()) return;
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role: role.trim() || undefined,
      };
      if (shiftWeekdays.size > 0) {
        body.weeklyShiftSeed = {
          weekdays: Array.from(shiftWeekdays).sort((a, b) => a - b),
          startTime: shiftStart,
          endTime: shiftEnd,
          weeksAhead,
        };
      }

      const res = await fetch("/api/admin/employees", {
        ...fetchOpts,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "追加失敗");
      const n = typeof data.shiftCount === "number" ? data.shiftCount : 0;
      setMessage(
        n > 0 ? `従業員を追加しました（シフトを ${n} 件登録しました）` : "従業員を追加しました",
      );
      setName("");
      setRole("");
      setShiftWeekdays(new Set(DEFAULT_WEEKDAYS));
      setShiftStart("09:00");
      setShiftEnd("18:00");
      setWeeksAhead(12);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const deleteEmployee = async (id: string, displayName: string) => {
    if (
      !confirm(
        `従業員「${displayName}」を削除しますか？\nこの人のシフト記録もまとめて削除されます。（取り消しできません）`,
      )
    ) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, { ...fetchOpts, method: "DELETE" });
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
    <main className="surface-page flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="ui-header shrink-0">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">従業員</h1>
          <p className="mt-1 text-xs text-slate-600">
            追加時に曜日・時間を指定すると、今後のシフトをまとめて登録できます。休みの日はシフト管理画面で日ごとに削除・変更できます。
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-7xl min-h-0 w-full flex-1 space-y-6 overflow-y-auto px-4 py-8 sm:px-6">
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="ui-card space-y-5 p-5 md:p-6">
          <h2 className="text-base font-bold text-slate-900">追加</h2>
          <div className="flex flex-wrap gap-3">
            <input className="ui-input max-w-xs py-2 text-sm" placeholder="氏名" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="ui-input max-w-xs py-2 text-sm" placeholder="役割（任意）" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold text-slate-700">出勤パターン（任意）</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              曜日を1つ以上選ぶと、今日から指定した週数ぶん、その曜日ごとに同じ時間のシフトを作成します。チェックをすべて外すと従業員のみ登録されます。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={shiftWeekdays.has(value)}
                    onChange={() => toggleWeekday(value)}
                  />
                  <span className="font-medium text-slate-800">{label}</span>
                </label>
              ))}
            </div>
            {shiftWeekdays.size > 0 ? (
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="block text-xs font-semibold text-slate-600">
                  開始
                  <input
                    type="time"
                    className="ui-input mt-1 py-2 font-mono text-sm"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value.slice(0, 5))}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  終了
                  <input
                    type="time"
                    className="ui-input mt-1 py-2 font-mono text-sm"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value.slice(0, 5))}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  先の週数（最大52）
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className="ui-input mt-1 w-24 py-2 text-sm tabular-nums"
                    value={weeksAhead}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isNaN(v)) setWeeksAhead(12);
                      else setWeeksAhead(Math.min(52, Math.max(1, v)));
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <button type="button" className="ui-btn-primary" onClick={() => void addEmployee()}>
            追加
          </button>
        </div>

        <div className="ui-card overflow-hidden p-0 md:p-0">
          <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3">
            <h2 className="text-base font-bold text-slate-900">一覧</h2>
          </div>
          {loading ? (
            <p className="px-5 py-8 text-sm text-slate-500">読み込み中…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <span className="font-semibold text-slate-900">{e.name}</span>
                    {e.role ? <span className="ml-2 text-sm text-slate-600">({e.role})</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={e.active}
                        onChange={(ev) => void toggleActive(e.id, ev.target.checked)}
                      />
                      有効
                    </label>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50"
                      onClick={() => void deleteEmployee(e.id, e.name)}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
