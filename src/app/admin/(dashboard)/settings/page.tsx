"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";
import { utcIsoFromYmd, utcMonthMeta } from "@/lib/calendar-grid";

const WD_LABELS = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
const fetchOpts: RequestInit = { credentials: "include" };

type WeekdayRule = { weekday: number; isClosed: boolean };
type Override = {
  date: unknown;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  memo: string | null;
};

function dateIso(d: unknown): string {
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

type ScheduleDefaults = {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  reservationMinutes: number;
};

export default function SettingsPage() {
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDefaults | null>(null);
  const [scheduleStoredInDb, setScheduleStoredInDb] = useState<boolean | null>(null);
  const [envFallback, setEnvFallback] = useState<ScheduleDefaults | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [weekdayRules, setWeekdayRules] = useState<WeekdayRule[]>([]);
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
  });
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ovDate, setOvDate] = useState("");
  const [ovClosed, setOvClosed] = useState(false);
  const [ovOpen, setOvOpen] = useState("09:00");
  const [ovClose, setOvClose] = useState("18:00");
  const [ovMemo, setOvMemo] = useState("");

  const monthRange = useMemo(() => {
    const { lastDay } = utcMonthMeta(cursor.y, cursor.m);
    return {
      from: utcIsoFromYmd(cursor.y, cursor.m, 1),
      to: utcIsoFromYmd(cursor.y, cursor.m, lastDay),
    };
  }, [cursor]);

  const loadSettings = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", fetchOpts);
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "設定取得失敗");
      if (data.defaults && typeof data.defaults === "object") {
        const d = data.defaults as Record<string, unknown>;
        const next: ScheduleDefaults = {
          openTime: String(d.openTime ?? "09:00"),
          closeTime: String(d.closeTime ?? "18:00"),
          slotMinutes: Number(d.slotMinutes ?? 30),
          reservationMinutes: Number(d.reservationMinutes ?? 60),
        };
        setScheduleDraft(next);
      }
      setScheduleStoredInDb(typeof data.scheduleStoredInDb === "boolean" ? data.scheduleStoredInDb : null);
      if (data.envFallback && typeof data.envFallback === "object") {
        const e = data.envFallback as Record<string, unknown>;
        setEnvFallback({
          openTime: String(e.openTime ?? "09:00"),
          closeTime: String(e.closeTime ?? "18:00"),
          slotMinutes: Number(e.slotMinutes ?? 30),
          reservationMinutes: Number(e.reservationMinutes ?? 60),
        });
      } else setEnvFallback(null);
      const wr = Array.isArray(data.weekdayRules) ? data.weekdayRules : [];
      setWeekdayRules(wr as WeekdayRule[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/overrides?from=${monthRange.from}&to=${monthRange.to}`, fetchOpts);
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "上書き取得失敗");
      setOverrides(Array.isArray(data.overrides) ? (data.overrides as Override[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setOverrides([]);
    }
  }, [monthRange.from, monthRange.to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadSettings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const saveSchedule = async () => {
    if (!scheduleDraft) return;
    setMessage(null);
    setError(null);
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/admin/settings", {
        ...fetchOpts,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openTime: scheduleDraft.openTime,
          closeTime: scheduleDraft.closeTime,
          slotMinutes: scheduleDraft.slotMinutes,
          reservationMinutes: scheduleDraft.reservationMinutes,
        }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "保存失敗");
      if (data.defaults && typeof data.defaults === "object") {
        const d = data.defaults as Record<string, unknown>;
        setScheduleDraft({
          openTime: String(d.openTime ?? "09:00"),
          closeTime: String(d.closeTime ?? "18:00"),
          slotMinutes: Number(d.slotMinutes ?? 30),
          reservationMinutes: Number(d.reservationMinutes ?? 60),
        });
      }
      setScheduleStoredInDb(true);
      setMessage("デフォルト営業時間を保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleWeekday = async (weekday: number, isClosed: boolean) => {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekday-rules", {
        ...fetchOpts,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekday, isClosed }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "更新失敗");
      setMessage("定休日を更新しました");
      await loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const saveOverride = async () => {
    if (!ovDate) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/overrides", {
        ...fetchOpts,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: ovDate,
          isClosed: ovClosed,
          openTime: ovClosed ? null : ovOpen,
          closeTime: ovClosed ? null : ovClose,
          memo: ovMemo.trim() || null,
        }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "保存失敗");
      setMessage("日別設定を保存しました");
      setOvDate("");
      setOvMemo("");
      await loadOverrides();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const removeOverride = async (dateStr: string) => {
    if (!confirm("この日の上書き設定を削除しますか？")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/overrides?date=${encodeURIComponent(dateStr)}`, {
        ...fetchOpts,
        method: "DELETE",
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "削除失敗");
      setMessage("削除しました");
      await loadOverrides();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  const ruleByWd = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const r of weekdayRules) m.set(r.weekday, r.isClosed);
    return m;
  }, [weekdayRules]);

  return (
    <main className="surface-page">
      <header className="ui-header">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">工場設定</h1>
          <p className="mt-1 text-xs text-slate-600">営業時間の基準・定休日・特定日の休業や時間変更を管理します。</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="ui-card p-5 md:p-6">
          <h2 className="text-base font-bold text-slate-900">デフォルト営業時間</h2>
          <p className="mt-1 text-xs text-slate-600">
            予約枠の生成に使う開店・閉店・スロット間隔・1件の予約長です。保存するとデータベースに記録されます。
          </p>
          {scheduleStoredInDb === false && envFallback ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              まだ DB に未保存のため、環境変数ベースです（参考: 開店 {envFallback.openTime} / 閉店 {envFallback.closeTime}）。
            </p>
          ) : scheduleStoredInDb === true ? (
            <p className="mt-3 text-xs text-emerald-800">データベースに保存済みです。</p>
          ) : null}
          {loading || !scheduleDraft ? (
            <p className="mt-3 text-sm text-slate-500">読み込み中…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">開店</span>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900"
                    value={scheduleDraft.openTime}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, openTime: e.target.value } : d))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">閉店</span>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900"
                    value={scheduleDraft.closeTime}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, closeTime: e.target.value } : d))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">スロット間隔（分）</span>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900"
                    value={scheduleDraft.slotMinutes}
                    onChange={(e) =>
                      setScheduleDraft((d) =>
                        d ? { ...d, slotMinutes: Number.parseInt(e.target.value, 10) || 0 } : d,
                      )
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-slate-500">1件の予約長（分）</span>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900"
                    value={scheduleDraft.reservationMinutes}
                    onChange={(e) =>
                      setScheduleDraft((d) =>
                        d ? { ...d, reservationMinutes: Number.parseInt(e.target.value, 10) || 0 } : d,
                      )
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={savingSchedule}
                onClick={() => void saveSchedule()}
              >
                {savingSchedule ? "保存中…" : "デフォルト営業時間を保存"}
              </button>
            </div>
          )}
        </div>

        <div className="ui-card p-5 md:p-6">
          <h2 className="text-base font-bold text-slate-900">曜日別・定休日</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {WD_LABELS.map((label, wd) => (
              <li
                key={wd}
                className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={ruleByWd.get(wd) ?? false}
                    onChange={(e) => void toggleWeekday(wd, e.target.checked)}
                  />
                  休業
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="ui-card p-5 md:p-6">
          <h2 className="text-base font-bold text-slate-900">特定日の休業・時間変更</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
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
            <span className="text-sm font-bold tabular-nums">
              {cursor.y}年{cursor.m}月
            </span>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
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
          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="ui-label text-xs">対象日</span>
              <input type="date" className="ui-input py-2 text-sm" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={ovClosed} onChange={(e) => setOvClosed(e.target.checked)} />
              終日休業
            </label>
            {!ovClosed ? (
              <>
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">開始（上書き）</span>
                  <input type="time" className="ui-input py-2 font-mono text-sm" value={ovOpen} onChange={(e) => setOvOpen(e.target.value.slice(0, 5))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="ui-label text-xs">終了（上書き）</span>
                  <input type="time" className="ui-input py-2 font-mono text-sm" value={ovClose} onChange={(e) => setOvClose(e.target.value.slice(0, 5))} />
                </label>
              </>
            ) : null}
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="ui-label text-xs">メモ（任意）</span>
              <input className="ui-input py-2 text-sm" value={ovMemo} onChange={(e) => setOvMemo(e.target.value)} placeholder="例: 創立記念日" />
            </label>
          </div>
          <button type="button" className="ui-btn-primary mt-4" disabled={!ovDate} onClick={() => void saveOverride()}>
            日別設定を保存
          </button>
          <ul className="mt-6 space-y-2 border-t border-slate-100 pt-6">
            {overrides.length === 0 ? (
              <li className="text-sm text-slate-500">この月に上書き設定はありません。</li>
            ) : (
              overrides.map((o) => {
                const ds = dateIso(o.date);
                return (
                  <li
                    key={ds}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-900">{ds}</span>
                      <span className="ml-2 text-slate-600">
                        {o.isClosed ? "休業" : `${o.openTime ?? "—"}–${o.closeTime ?? "—"}`}
                      </span>
                      {o.memo ? <span className="ml-2 text-xs text-slate-500">（{o.memo}）</span> : null}
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700 hover:underline"
                      onClick={() => void removeOverride(ds)}
                    >
                      削除
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
