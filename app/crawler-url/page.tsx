import { AppShell } from "@/components/app-shell";
import CrawlerUrlClient from "@/components/crawler/crawler-url-client";

export default function CrawlerUrlPage() {
  return (
    <AppShell title="Crawler URL">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Crawler URL</h1>
        <p className="mt-1 text-sm text-muted">Nhập tối đa 10 Google Dorks → Serper.dev → crawl HTML → phân loại CMS.</p>
      </div>
      <CrawlerUrlClient />
    </AppShell>
  );
}
