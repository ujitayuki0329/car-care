"use client";

import { useEffect } from "react";
import { parseMemoBodyFromNotes, parseMenuFromNotes } from "@/lib/reservation-notes";

export type ReservationDetailFields = {
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

function formatJpDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default function ReservationDetailModal({
  reservation,
  onClose,
}: {
  reservation: ReservationDetailFields | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!reservation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reservation, onClose]);

  if (!reservation) return null;

  const menu = parseMenuFromNotes(reservation.notes);
  const memoBody = parseMemoBodyFromNotes(reservation.notes);
  const registered = formatJpDateTime(reservation.createdAt);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 id="reservation-detail-title" className="text-base font-bold text-slate-900">
              予約の詳細
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{reservation.id}</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-[7rem_1fr] sm:gap-x-3 sm:gap-y-2">
            <dt className="text-xs font-semibold text-slate-500">日時</dt>
            <dd className="font-mono font-medium text-slate-900">
              {reservation.date}{" "}
              <span className="text-slate-600">
                {reservation.startTime}–{reservation.endTime}
              </span>
            </dd>

            <dt className="text-xs font-semibold text-slate-500">お名前</dt>
            <dd className="font-medium text-slate-900">{reservation.customerName}</dd>

            <dt className="text-xs font-semibold text-slate-500">電話</dt>
            <dd className="font-mono text-slate-800">{reservation.phone}</dd>

            <dt className="text-xs font-semibold text-slate-500">メール</dt>
            <dd className="break-all text-slate-800">{reservation.email ?? "—"}</dd>

            <dt className="text-xs font-semibold text-slate-500">ご希望メニュー</dt>
            <dd>
              {menu ? (
                <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-950 ring-1 ring-amber-200/80">
                  {menu}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </dd>

            <dt className="text-xs font-semibold text-slate-500">車両・用件</dt>
            <dd className="whitespace-pre-wrap break-words text-slate-800">{reservation.vehicleInfo?.trim() || "—"}</dd>

            <dt className="text-xs font-semibold text-slate-500">メモ</dt>
            <dd className="whitespace-pre-wrap break-words text-slate-800">{memoBody ?? "—"}</dd>

            <dt className="text-xs font-semibold text-slate-500">経路</dt>
            <dd>
              <span
                className={
                  reservation.source === "PHONE"
                    ? "inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800"
                    : "inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700"
                }
              >
                {reservation.source === "PHONE" ? "電話" : "Web"}
              </span>
            </dd>

            <dt className="text-xs font-semibold text-slate-500">状態</dt>
            <dd>
              <span
                className={
                  reservation.status === "CONFIRMED"
                    ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800"
                    : reservation.status === "CANCELLED"
                      ? "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800"
                      : "inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700"
                }
              >
                {reservation.status}
              </span>
            </dd>

            {registered ? (
              <>
                <dt className="text-xs font-semibold text-slate-500">登録日時</dt>
                <dd className="text-slate-700">{registered}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}
