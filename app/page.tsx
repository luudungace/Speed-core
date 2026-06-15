import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OperationsOverview } from "@/components/dashboard/operations-overview";
import { getDashboardStatsSafe } from "@/lib/services/dashboard-stats";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const stats = await getDashboardStatsSafe();

  return (
    <AppShell title="Tổng quan">
      <OperationsOverview stats={stats} />
    </AppShell>
  );
}
