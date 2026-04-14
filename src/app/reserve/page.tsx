"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { asRecord, safeParseJson } from "@/lib/parse-api";
import { todayUtcIso, utcIsoFromYmd, utcMonthMeta, ymFromIsoDate, ymIsBefore } from "@/lib/calendar-grid";
import { SERVICE_MENU_ITEMS, type ServiceMenu } from "@/lib/service-menu";

type DaySummary = { date: string; isOpen: boolean; hasAvailableSlot: boolean };
type SlotRow = {
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  available: boolean;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: { step: Exclude<Step, 6>; label: string }[] = [
  { step: 1, label: "メニュー" },
  { step: 2, label: "日付" },
  { step: 3, label: "時間" },
  { step: 4, label: "お客様情報" },
  { step: 5, label: "確認" },
];

const panelClass =
  "w-full rounded-none border-x-0 border-y border-slate-200/60 bg-white px-4 py-6 shadow-sm sm:rounded-2xl sm:border sm:border-slate-200/60 sm:px-6";

const sectionTitleClass =
  "border-l-2 border-brand-600 pl-3 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl";

const backBtnClass =
  "w-full shrink-0 rounded-xl border border-slate-200/90 bg-slate-50/80 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow sm:w-auto sm:border-0 sm:bg-transparent sm:py-0 sm:text-left sm:shadow-none sm:underline sm:underline-offset-4";

export default function ReservePage() {
  const todayIso = useMemo(() => todayUtcIso(), []);

  const [cursor, setCursor] = useState(() => ymFromIsoDate(todayUtcIso()));
  const [days, setDays] = useState<DaySummary[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<ServiceMenu | null>(null);
  const [step, setStep] = useState<Step>(1);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setLoadingCal(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/calendar?year=${cursor.y}&month=${cursor.m}`, { cache: "no-store" });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "カレンダー取得失敗");
      setDays(Array.isArray(data.days) ? (data.days as DaySummary[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setDays([]);
    } finally {
      setLoadingCal(false);
    }
  }, [cursor]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/slots?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "枠取得失敗");
      setSlots(Array.isArray(data.slots) ? (data.slots as SlotRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const onPickDate = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep(3);
    await loadSlots(date);
  };

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

  const earliestYm = useMemo(() => ymFromIsoDate(todayIso), [todayIso]);
  const prevYm = cursor.m > 1 ? { y: cursor.y, m: cursor.m - 1 } : { y: cursor.y - 1, m: 12 };
  const prevMonthDisabled = ymIsBefore(prevYm, earliestYm);

  const submit = async () => {
    if (!selectedDate || !selectedSlot || !selectedMenu) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          email: email || undefined,
          vehicleInfo: vehicleInfo || undefined,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          serviceMenu: selectedMenu,
          notes: notes || undefined,
        }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "予約失敗");
      const id = data.id;
      if (typeof id !== "string" || !id) throw new Error("応答が不正です");
      setDoneId(id);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-brand-700">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-sm transition group-hover:bg-brand-800">
              C
            </span>
            トップへ
          </Link>
          <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
            ネット予約
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 pt-7 sm:px-6 sm:pt-9">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">ご予約</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
          メニュー・日付・時間・お客様情報の順に進みます。
        </p>

        {step < 6 ? (
          <nav
            className="mt-7 rounded-2xl border border-slate-200/70 bg-white p-2 shadow-sm"
            aria-label="進行状況"
          >
            <ol className="grid grid-cols-5 gap-1.5" role="list">
              {STEPS.map(({ step: sn, label }) => {
                const active = step === sn;
                const done = step > sn;
                return (
                  <li key={sn} className="min-w-0">
                    <div
                      className={[
                        "flex min-h-[2.85rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-center text-[10px] font-semibold leading-tight transition sm:min-h-[2.65rem] sm:flex-row sm:gap-1 sm:px-1 sm:py-2.5 sm:text-[11px]",
                        active
                          ? "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm ring-1 ring-black/5"
                          : done
                            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100/80"
                            : "bg-slate-100/90 text-slate-500",
                      ].join(" ")}
                    >
                      <span className="tabular-nums">{sn}</span>
                      <span className="max-w-[4.5rem] text-center leading-snug sm:max-w-none">{label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <div className="mt-6 space-y-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          {step === 1 && (
            <section className={panelClass}>
              <h2 className={sectionTitleClass}>ご希望のメニュー</h2>
              <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SERVICE_MENU_ITEMS.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMenu(label);
                        setStep(2);
                      }}
                      className="flex min-h-[3rem] w-full items-center rounded-xl border border-slate-200/70 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-brand-500/40 hover:bg-brand-50/40"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 2 && selectedMenu && (
            <section className={panelClass}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className={sectionTitleClass}>日付を選択</h2>
                <button type="button" className={backBtnClass} onClick={() => setStep(1)}>
                  ← メニューに戻る
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  disabled={prevMonthDisabled}
                  className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                  onClick={() => {
                    if (prevMonthDisabled) return;
                    setCursor((c) => {
                      const nm = c.m - 1;
                      if (nm >= 1) return { y: c.y, m: nm };
                      return { y: c.y - 1, m: 12 };
                    });
                  }}
                >
                  ‹
                </button>
                <span className="text-sm font-bold tabular-nums">
                  {cursor.y}年{cursor.m}月
                </span>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium"
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
              <p className="mb-4 mt-3 text-xs text-slate-600">
                <span className="font-bold text-emerald-600">○</span>＝空き枠あり ·{" "}
                <span className="font-bold text-amber-600">×</span>＝満席 · <span className="font-semibold text-slate-400">休</span>
                ＝休業
              </p>
              {loadingCal ? (
                <p className="text-sm text-slate-500">読み込み中…</p>
              ) : (
                <>
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">
                    {["日", "月", "火", "水", "木", "金", "土"].map((w, wi) => (
                      <div key={w} className={wi === 0 || wi === 6 ? "text-rose-500/90" : ""}>
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((c, idx) =>
                      c.day === 0 ? (
                        <div key={`e-${idx}`} />
                      ) : (
                        (() => {
                          const cellIso = utcIsoFromYmd(cursor.y, cursor.m, c.day);
                          const isPastDay = cellIso < todayIso;
                          const selectable =
                            !isPastDay && Boolean(c.summary?.isOpen && c.summary?.hasAvailableSlot);
                          return (
                            <button
                              key={cellIso}
                              type="button"
                              disabled={!selectable}
                              onClick={() => c.summary && void onPickDate(c.summary.date)}
                              className={[
                                "flex min-h-[4rem] flex-col items-center justify-center rounded-lg border text-xs sm:min-h-[4.5rem] sm:rounded-xl",
                                !selectable
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50/80 text-slate-300"
                                  : "border-slate-200/90 bg-white hover:border-brand-400 hover:bg-brand-50",
                              ].join(" ")}
                            >
                              <span className="text-sm font-bold tabular-nums">{c.day}</span>
                              <span className="mt-0.5 text-[10px] font-bold">
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
                            </button>
                          );
                        })()
                      ),
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {step === 3 && selectedMenu && selectedDate && (
            <section className={panelClass}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div>
                  <h2 className={sectionTitleClass}>時間を選択</h2>
                  <p className="mt-2 font-mono text-sm text-brand-700">{selectedDate}</p>
                </div>
                <button type="button" className={backBtnClass} onClick={() => setStep(2)}>
                  ← 日付に戻る
                </button>
              </div>
              {loadingSlots ? (
                <p className="text-sm text-slate-500">読み込み中…</p>
              ) : (
                <ul className="grid gap-2">
                  {slots
                    .filter((s) => s.available)
                    .map((s) => (
                      <li key={s.startTime}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlot(s);
                            setStep(4);
                          }}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold hover:border-brand-500 hover:bg-brand-50"
                        >
                          {s.startTime} 〜 {s.endTime}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            （残り {s.capacity - s.booked}）
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              {!loadingSlots && !slots.filter((s) => s.available).length ? (
                <p className="text-sm text-slate-500">この日は空き枠がありません。別の日付をお選びください。</p>
              ) : null}
            </section>
          )}

          {step === 4 && selectedSlot && selectedDate && selectedMenu && (
            <section className={panelClass}>
              <h2 className={sectionTitleClass}>お客様情報</h2>
              <button type="button" className={`${backBtnClass} mt-2`} onClick={() => setStep(3)}>
                ← 時間に戻る
              </button>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="ui-label text-xs">お名前</span>
                  <input className="ui-input mt-1 py-2 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </label>
                <label className="sm:col-span-2">
                  <span className="ui-label text-xs">電話番号</span>
                  <input className="ui-input mt-1 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                </label>
                <label>
                  <span className="ui-label text-xs">メール（任意）</span>
                  <input type="email" className="ui-input mt-1 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="sm:col-span-2">
                  <span className="ui-label text-xs">車両・用件（任意）</span>
                  <input className="ui-input mt-1 py-2 text-sm" value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)} />
                </label>
                <label className="sm:col-span-2">
                  <span className="ui-label text-xs">メモ（任意）</span>
                  <input className="ui-input mt-1 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
              </div>
              <button
                type="button"
                className="ui-btn-primary mt-6 w-full sm:w-auto"
                disabled={!customerName.trim() || phone.length < 10}
                onClick={() => setStep(5)}
              >
                確認へ
              </button>
            </section>
          )}

          {step === 5 && selectedSlot && selectedDate && selectedMenu && (
            <section className={panelClass}>
              <h2 className={sectionTitleClass}>内容の確認</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">メニュー</dt>
                  <dd className="font-semibold">{selectedMenu}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">日時</dt>
                  <dd className="font-mono font-semibold">
                    {selectedDate} {selectedSlot.startTime} 〜 {selectedSlot.endTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">お名前</dt>
                  <dd>{customerName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">電話</dt>
                  <dd className="font-mono">{phone}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="ui-btn-secondary" onClick={() => setStep(4)}>
                  戻る
                </button>
                <button type="button" className="ui-btn-primary" disabled={submitting} onClick={() => void submit()}>
                  {submitting ? "送信中…" : "予約を確定する"}
                </button>
              </div>
            </section>
          )}

          {step === 6 && doneId && (
            <section className={panelClass}>
              <h2 className="text-xl font-semibold tracking-tight text-emerald-900">ご予約が完了しました</h2>
              <p className="mt-2 text-sm text-slate-600">
                予約ID: <span className="font-mono font-semibold">{doneId}</span>
              </p>
              <Link href="/" className="ui-btn-primary mt-6 inline-flex">
                トップへ
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
