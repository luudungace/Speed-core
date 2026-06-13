import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { getBacklinkCandidateFromRaw } from "@/lib/utils/backlink-candidate";
import { getCrawlerRegisterLink } from "@/lib/utils/crawler-register-link";
import type { CrawlerRegisterFilter } from "@/lib/utils/crawler-url-view-state";
import { parseUrlDepthFilter } from "@/lib/utils/forum-url-filter";

export const runtime = "nodejs";

function parseRegisterFilter(value: string | null): CrawlerRegisterFilter {
  if (value === "has_register" || value === "no_register") return value;
  return "has_register";
}

function candidateRating(score: number, evidence: string[]) {
  const hasForumPostingUrl = evidence.includes("forum posting URL found");
  if (hasForumPostingUrl && score >= 70) return "Ngon";
  if (score >= 55) return "Có tiềm năng";
  if (score >= 30) return "Xem xét";
  return "Không có tiềm năng";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = new CrawlerRepository();
    const { rows } = await repo.listResults({
      page: 1,
      pageSize: 2000,
      search: searchParams.get("search") ?? "",
      cms: searchParams.get("cms") ?? "All CMS",
      urlDepth: parseUrlDepthFilter(searchParams.get("urlDepth")),
      jobId: searchParams.get("jobId"),
      registerFilter: parseRegisterFilter(searchParams.get("registerFilter")),
    });

    const items = rows
      .map((row) => {
        const registerUrl = getCrawlerRegisterLink(row);
        if (!registerUrl) return null;
        const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);
        return {
          id: row.id,
          url: registerUrl,
          sourceUrl: row.url,
          title: row.title,
          cms: row.cms_type,
          rating: candidate ? candidateRating(candidate.score, candidate.evidence) : "Xem xét",
          score: candidate?.score ?? 0,
          siteType: candidate?.site_type ?? row.cms_type,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ items: [], count: 0, error: message }, { status: 500 });
  }
}
