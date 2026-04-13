import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
          <div className="min-h-[38vh] shrink-0 bg-gradient-to-br from-slate-950 via-brand-900 to-[#0d4f47] lg:min-h-screen lg:w-[46%]" />
          <div className="flex flex-1 items-center justify-center px-5 py-10">
            <p className="text-sm text-slate-500">読み込み中…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
