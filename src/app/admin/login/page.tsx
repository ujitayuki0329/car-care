import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="surface-page flex min-h-screen flex-col items-center justify-center px-4">
          <p className="text-sm text-slate-600">読み込み中…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
