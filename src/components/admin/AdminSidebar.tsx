"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminClientLogout } from "@/lib/admin-logout-client";

export const ADMIN_NAV_ITEMS: { href: string; label: string; external?: boolean }[] = [
  { href: "/admin", label: "予約・カレンダー" },
  { href: "/admin/history", label: "予約履歴" },
  { href: "/admin/employees", label: "従業員" },
  { href: "/admin/shifts", label: "シフト" },
  { href: "/admin/settings", label: "工場設定" },
  { href: "/reserve", label: "公開予約（確認用）", external: true },
];

function linkClass(active: boolean) {
  return [
    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
    active
      ? "bg-white/[0.08] text-white"
      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
  ].join(" ");
}

function isActivePath(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin" || pathname === "/admin/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** ナビリンクのみ（ドロワー／デスクトップ共通） */
export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {ADMIN_NAV_ITEMS.map(({ href, label, external }) => {
        const active = isActivePath(pathname, href);
        if (external) {
          return (
            <Link
              key={href}
              href={href}
              className={linkClass(false)}
              target="_blank"
              rel="noreferrer"
              onClick={() => onNavigate?.()}
            >
              {label}
            </Link>
          );
        }
        return (
          <Link key={href} href={href} className={linkClass(active)} onClick={() => onNavigate?.()}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** サイドバー下部：ログアウト + バージョン */
export function AdminSidebarFooter({ onBeforeLogout }: { onBeforeLogout?: () => void }) {
  return (
    <div className="mt-auto shrink-0 border-t border-white/[0.06] p-3">
      <button
        type="button"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:border-red-500/30 hover:bg-red-950/40 hover:text-red-100"
        onClick={() => {
          onBeforeLogout?.();
          void adminClientLogout();
        }}
      >
        ログアウト
      </button>
      <p className="mt-3 text-[10px] text-slate-500">v1</p>
    </div>
  );
}

/** md 以上でのみ表示する固定サイドバー */
export default function AdminSidebar() {
  return (
    <aside className="hidden min-h-screen w-56 shrink-0 flex-col border-r border-slate-800/90 bg-slate-950 text-white md:flex">
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Car Care</p>
        <p className="mt-1 text-lg font-semibold leading-tight tracking-tight">管理コンソール</p>
      </div>
      <AdminNavigation />
      <AdminSidebarFooter />
    </aside>
  );
}
