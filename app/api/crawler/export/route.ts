import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import type { ContactItem } from "@/lib/types/crawler";
import { getAuthLinks, getCrawlerRegisterLink } from "@/lib/utils/auth-links";

export const runtime = "nodejs";

function contactValues(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item: ContactItem) => item.value).filter(Boolean).join(", ");
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
    status: parseStatusFilter(searchParams.get("status")),
    registerFilter: parseRegisterFilter(searchParams.get("registerFilter")),
    urlDepth: searchParams.get("urlDepth") ?? "Tất cả URL",
    jobId: searchParams.get("jobId") ?? undefined,
  });

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => {
      const links = getAuthLinks({
        url: row.url,
        domain: row.domain,
        cmsType: row.cms_type,
      });

      return {
        URL: row.url,
        Domain: row.domain,
        "Register link": getCrawlerRegisterLink({ url: row.url, domain: row.domain, cmsType: row.cms_type }),
        "Login link": links.login,
        Title: row.title ?? "",
        CMS: row.cms_type,
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

function parseRegisterFilter(value: string | null) {
  return value === "with" || value === "without" ? value : "all";
}

function parseStatusFilter(value: string | null) {
  return value === "success" || value === "other" ? value : undefined;
}
