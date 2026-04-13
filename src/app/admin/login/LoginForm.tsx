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
  const isDev = process.env.NODE_ENV === "development";

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
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* 左：ブランド */}
      <div className="relative flex min-h-[38vh] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-brand-900 to-[#0d4f47] px-8 pb-8 pt-10 sm:min-h-[42vh] sm:px-10 sm:pb-10 sm:pt-12 lg:min-h-screen lg:w-[46%] lg:max-w-xl lg:px-12 lg:pb-12 lg:pt-14 xl:w-[42%]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,transparent_50%,rgba(255,255,255,0.03)_100%)]" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
            <defs>
              <pattern id="login-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-grid)" />
          </svg>
        </div>

        <div className="relative z-[1]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm sm:h-14 sm:w-14 sm:text-xl">
              C
            </div>
            <div className="h-px flex-1 max-w-[4rem] bg-gradient-to-r from-white/40 to-transparent sm:max-w-[5rem]" />
          </div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-200/90">Car Care</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]">
            整備予約
            <span className="mt-1 block text-2xl font-semibold text-white/90 sm:text-3xl lg:text-[1.75rem]">
              管理コンソール
            </span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/65 sm:text-[15px]">
            受付カレンダー・予約・シフト・工場設定をひとつの画面で。スタッフ専用のサインインです。
          </p>
        </div>

        <div className="relative z-[1] mt-8 flex flex-wrap items-center gap-4 lg:mt-0">
          <p className="text-[11px] text-white/35">Automotive service · Reservation admin</p>
          <Link
            href="/"
            className="text-[11px] font-medium text-white/50 underline-offset-4 transition hover:text-white/80 hover:underline"
          >
            公開サイトへ
          </Link>
        </div>
      </div>

      {/* 右：アカウント情報 + ログイン */}
      <div className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[420px] space-y-6">
          <div className="space-y-1 lg:pt-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">サインイン</h2>
            <p className="text-sm text-slate-500">登録済みのスタッフアカウントでログインしてください。</p>
          </div>

          {isDev ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
                  dev
                </span>
                <p className="text-sm font-semibold text-slate-800">ローカル · アカウント情報</p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                初回は{" "}
                <code className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                  npx prisma db seed
                </code>{" "}
                を実行してください。
              </p>
              <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0 font-medium text-slate-500 sm:w-24">メール</dt>
                  <dd className="font-mono text-[13px] font-medium text-slate-900">{DEV_ADMIN_EMAIL}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0 font-medium text-slate-500 sm:w-24">パスワード</dt>
                  <dd className="font-mono text-[13px] font-medium text-slate-900">{DEV_ADMIN_PASSWORD_DEFAULT}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                `SEED_ADMIN_PASSWORD` を指定してシードした場合は、その値でログインします。
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-950/80">
              <span className="font-semibold text-amber-900/90">スタッフ専用 · </span>
              このページは許可されたアカウントのみが利用できます。心当たりがない場合は管理者へお問い合わせください。
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] sm:p-8">
            {error ? (
              <div className="mb-5 rounded-xl border border-red-200/90 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</div>
            ) : null}
            <form className="space-y-4" onSubmit={(e) => void submit(e)}>
              <label className="block">
                <span className="ui-label text-xs">メールアドレス</span>
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
              <button type="submit" className="ui-btn-primary mt-3 w-full py-3 text-[15px]" disabled={loading}>
                {loading ? "送信中…" : "ログイン"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400">
            <Link href="/" className="font-medium text-brand-700 transition hover:text-brand-800 hover:underline">
              トップページへ戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
