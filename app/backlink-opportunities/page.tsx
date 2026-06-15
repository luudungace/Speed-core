import { AppShell } from "@/components/app-shell";
import { BacklinkOpportunityClient } from "@/components/backlink-opportunities/backlink-opportunity-client";

export const runtime = "nodejs";

export default function BacklinkOpportunitiesPage() {
  return (
    <AppShell title="Cơ hội Backlink">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Cơ hội Backlink</h1>
        <p className="mt-1 text-sm text-muted">
          Tìm kiếm và phân tích cơ hội đặt backlink từ đối thủ cạnh tranh bằng cách quét backlinks.sh và crawl Playwright.
        </p>
      </div>
      <BacklinkOpportunityClient />
    </AppShell>
  );
}
