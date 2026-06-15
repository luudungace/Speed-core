import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";

export const runtime = "nodejs";

function formatUrlList(urls: { url: string; text: string }[] | null | undefined): string {
  if (!Array.isArray(urls)) return "";
  return urls.map((item) => item.url).filter(Boolean).join(", ");
}

function formatContactList(contacts: { value: string; source: string }[] | null | undefined): string {
  if (!Array.isArray(contacts)) return "";
  return contacts.map((item) => item.value).filter(Boolean).join(", ");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Thiếu projectId." }, { status: 400 });
    }

    const repo = new BacklinkOpportunityRepository();

    const search = searchParams.get("search") || undefined;
    const siteType = searchParams.get("siteType") || undefined;
    const cmsType = searchParams.get("cmsType") || undefined;
    
    const minScoreStr = searchParams.get("minScore");
    const minScore = minScoreStr ? parseInt(minScoreStr, 10) : undefined;
    
    const minCompCountStr = searchParams.get("minCompetitorCount");
    const minCompetitorCount = minCompCountStr ? parseInt(minCompCountStr, 10) : undefined;
    
    const hasRegistration = searchParams.get("hasRegistration") === "true";
    const hasSubmit = searchParams.get("hasSubmit") === "true";
    const hasProfile = searchParams.get("hasProfile") === "true";

    // Load up to 10000 opportunities for export
    const { rows } = await repo.listOpportunities({
      projectId,
      search,
      siteType,
      cmsType,
      minScore,
      minCompetitorCount,
      hasRegistration,
      hasSubmit,
      hasProfile,
      page: 1,
      pageSize: 10000,
    });

    const dataSheet = rows.map((row) => ({
      "Source URL": row.source_url,
      "Source Domain": row.source_domain,
      "Title": row.title ?? "",
      "CMS Type": row.cms_type,
      "Site Type": row.site_type,
      "Score": row.score,
      "Competitor Count": row.competitor_count,
      "Competitors": Array.isArray(row.competitors) ? row.competitors.join(", ") : "",
      "Registration URLs": formatUrlList(row.registration_urls),
      "Login URLs": formatUrlList(row.login_urls),
      "Submit URLs": formatUrlList(row.submit_urls),
      "Profile URLs": formatUrlList(row.profile_urls),
      "Emails": formatContactList(row.emails),
      "Phones": formatContactList(row.phones),
      "Crawl Status": row.crawl_status,
      "Error": row.error ?? "",
      "Crawl Time (s)": row.crawl_time,
      "Last Crawled At": row.last_crawled_at ?? "",
    }));

    const sheet = XLSX.utils.json_to_sheet(dataSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Backlink Opportunities");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="backlink-opportunities-${projectId}.xlsx"`,
      },
    });
  } catch (err: any) {
    const message = err.message || String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
