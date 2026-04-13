"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar, { AdminNavigation, AdminSidebarFooter } from "./AdminSidebar";

export default function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface)] md:flex-row">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-3 shadow-sm md:hidden">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-nav"
          aria-label="メニューを開く"
          onClick={() => setMobileOpen(true)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">管理コンソール</p>
          <p className="truncate text-[11px] text-slate-500">Car Care</p>
        </div>
      </header>

      <AdminSidebar />

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="admin-mobile-nav"
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] max-w-full flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
        ].join(" ")}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Car Care</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight">メニュー</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="メニューを閉じる"
            onClick={() => setMobileOpen(false)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <AdminNavigation onNavigate={() => setMobileOpen(false)} />
        <AdminSidebarFooter onBeforeLogout={() => setMobileOpen(false)} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
