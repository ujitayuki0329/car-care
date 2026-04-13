"use client";

import { useCallback, useEffect, useState } from "react";
import { asRecord, safeParseJson } from "@/lib/parse-api";

type Employee = { id: string; name: string; role: string | null; active: boolean; notes: string | null };

const fetchOpts: RequestInit = { credentials: "include" };

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

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
      const res = await fetch("/api/admin/employees", {
        ...fetchOpts,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim() || undefined }),
      });
      const raw = await safeParseJson(res);
      const data = asRecord(raw);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "追加失敗");
      setMessage("従業員を追加しました");
      setName("");
      setRole("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  };

  return (
    <main className="surface-page">
      <header className="ui-header">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">従業員</h1>
          <p className="mt-1 text-xs text-slate-600">整備士などの登録と有効/無効の切り替えができます。</p>
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
          <h2 className="text-base font-bold text-slate-900">追加</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <input className="ui-input max-w-xs py-2 text-sm" placeholder="氏名" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="ui-input max-w-xs py-2 text-sm" placeholder="役割（任意）" value={role} onChange={(e) => setRole(e.target.value)} />
            <button type="button" className="ui-btn-primary" onClick={() => void addEmployee()}>
              追加
            </button>
          </div>
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
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={e.active}
                      onChange={(ev) => void toggleActive(e.id, ev.target.checked)}
                    />
                    有効
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
