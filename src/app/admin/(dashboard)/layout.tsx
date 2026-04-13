import AdminDashboardShell from "@/components/admin/AdminDashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
