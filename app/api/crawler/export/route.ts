import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import type { ContactItem } from "@/lib/types/crawler";
import { getBacklinkCandidateFromRaw, type CandidateLink } from "@/lib/utils/backlink-candidate";
import type { CrawlerRegisterFilter } from "@/lib/utils/crawler-url-view-state";
import { parseUrlDepthFilter } from "@/lib/utils/forum-url-filter";

function parseRegisterFilter(value: string | null): CrawlerRegisterFilter {
  if (value === "has_register" || value === "no_register") return value;
  return "all";
}

export const runtime = "nodejs";

function contactValues(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item: ContactItem) => item.value).filter(Boolean).join(", ");
}

function linkValues(value: CandidateLink[]) {
  return value.map((item) => item.url).filter(Boolean).join(", ");
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

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => {
      const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);
      return {
        URL: row.url,
        Domain: row.domain,
        Title: row.title ?? "",
        Candidate: candidate?.status ?? "not_scanned",
        "Candidate score": candidate?.score ?? "",
        "Candidate type": candidate?.site_type ?? "",
        Evidence: candidate?.evidence.join(", ") ?? "",
        "Register URLs": candidate ? linkValues(candidate.registration_urls) : "",
        "Login URLs": candidate ? linkValues(candidate.login_urls) : "",
        "Submit URLs": candidate ? linkValues(candidate.submit_urls) : "",
        "Profile URLs": candidate ? linkValues(candidate.profile_urls) : "",
        Emails: contactValues(row.emails),
        Phones: contactValues(row.phones),
        Status: row.status,
        Error: row.error ?? "",
        "Crawl time": row.crawl_time,
        "Created at": row.created_at,
      };
    }),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "crawl_results");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="crawl-results.xlsx"',
    },
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
