import { AppShell } from "@/components/app-shell";
import { OperationsOverview } from "@/components/dashboard/operations-overview";
import { getDashboardStatsSafe } from "@/lib/services/dashboard-stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getDashboardStatsSafe();

  return (
    <AppShell title="Tổng quan">
      <OperationsOverview stats={stats} />
    </AppShell>
  );
}
