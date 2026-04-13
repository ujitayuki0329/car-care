"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href: string; label: string; external?: boolean }[] = [
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

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800/90 bg-slate-950 text-white">
      <div className="border-b border-white/[0.06] px-4 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Car Care</p>
        <p className="mt-1 text-lg font-semibold leading-tight tracking-tight">管理コンソール</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map(({ href, label, external }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname === href || pathname.startsWith(`${href}/`);
          if (external) {
            return (
              <Link key={href} href={href} className={linkClass(false)} target="_blank" rel="noreferrer">
                {label}
              </Link>
            );
          }
          return (
            <Link key={href} href={href} className={linkClass(active)}>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-3 text-[10px] text-slate-500">v1</div>
    </aside>
  );
}
