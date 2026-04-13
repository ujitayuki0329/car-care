"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** prisma/seed.ts と .env.example に合わせたローカル開発用の既定値 */
const DEV_ADMIN_EMAIL = "admin@example.com";
/** SEED_ADMIN_PASSWORD 未設定時のシード既定（seed.ts） */
const DEV_ADMIN_PASSWORD_DEFAULT = "admin1234";

export default function LoginForm() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? "/admin";

  const [email, setEmail] = useState(DEV_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "ログイン失敗");
      window.location.href = from.startsWith("/admin") ? from : "/admin";
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "エラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="surface-page flex min-h-screen flex-col">
      <header className="ui-header">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-sm">
            C
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Car Care</p>
            <h1 className="text-lg font-bold text-slate-900">管理ログイン</h1>
            <p className="mt-0.5 text-xs text-slate-600">スタッフ用アカウントでサインインします。</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="ui-card p-6 md:p-8">
            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}
            <form className="space-y-4" onSubmit={(e) => void submit(e)}>
              <label className="block">
                <span className="ui-label text-xs">メール</span>
                <input
                  type="email"
                  className="ui-input mt-1.5 py-2.5 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block">
                <span className="ui-label text-xs">パスワード</span>
                <input
                  type="password"
                  className="ui-input mt-1.5 py-2.5 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="ui-btn-primary mt-2 w-full py-2.5" disabled={loading}>
                {loading ? "送信中…" : "ログイン"}
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-slate-500">
              <Link href="/" className="font-medium text-brand-700 hover:underline">
                トップへ
              </Link>
            </p>
          </div>

          {process.env.NODE_ENV === "development" ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm">
              <p className="text-xs font-semibold text-slate-700">ローカル開発用 · 認証情報</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                初回は{" "}
                <code className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                  npx prisma db seed
                </code>{" "}
                を実行してください。
              </p>
              <dl className="mt-3 space-y-2 text-xs text-slate-700">
                <div>
                  <dt className="font-medium text-slate-500">メール</dt>
                  <dd className="mt-0.5 font-mono text-[13px] text-slate-900">{DEV_ADMIN_EMAIL}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">パスワード（既定）</dt>
                  <dd className="mt-0.5 font-mono text-[13px] text-slate-900">{DEV_ADMIN_PASSWORD_DEFAULT}</dd>
                  <dd className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    `.env` の `SEED_ADMIN_PASSWORD` を付けてシードした場合は、その値でログインしてください。
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
