"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrawlerUrlClient } from "@/components/crawler/crawler-url-client";
import { DorkScraperClient } from "@/components/dork-scraper/dork-scraper-client";

export default function CrawlerUrlPage() {
  const [activeTab, setActiveTab] = useState<"dork" | "quick">("dork");

  return (
    <AppShell title="Cào Dork & Crawl URL">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-white">Cào Dork & Crawl URL</h1>
          <p className="mt-1 text-sm text-slate-400">
            Khai thác diễn đàn quốc tế bằng Google Dorks hoặc quét nhanh link đối thủ để nhận diện CMS.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex rounded-md bg-[#162130] p-1 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("dork")}
            className={`rounded px-4 py-1.5 text-sm font-semibold transition ${
              activeTab === "dork"
                ? "bg-[#070c14] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Dự án Google Dork
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={`rounded px-4 py-1.5 text-sm font-semibold transition ${
              activeTab === "quick"
                ? "bg-[#070c14] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Crawl nhanh (Dork/Đối thủ)
          </button>
        </div>
      </div>

      {activeTab === "dork" ? <DorkScraperClient /> : <CrawlerUrlClient />}
    </AppShell>
  );
}
