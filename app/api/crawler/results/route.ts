import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { normalizeExcludeDomains } from "@/lib/utils/crawler-filters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = new CrawlerRepository();
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const data = await repo.listResults({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      search: searchParams.get("search") ?? "",
      cms: searchParams.get("cms") ?? "All CMS",
      status: parseStatusFilter(searchParams.get("status")),
      registerFilter: parseRegisterFilter(searchParams.get("registerFilter")),
      urlDepth: searchParams.get("urlDepth") ?? "Tất cả URL",
      jobId: searchParams.get("jobId") ?? undefined,
      excludeDomains: normalizeExcludeDomains(searchParams.get("excludeDomains") ?? ""),
      dedupeByDomain: searchParams.get("dedupeByDomain") !== "false",
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: message }, { status: 500 });
  }
}

function parseRegisterFilter(value: string | null) {
  return value === "with" || value === "without" ? value : "all";
}

function parseStatusFilter(value: string | null) {
  return value === "success" || value === "other" ? value : undefined;
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const repo = new CrawlerRepository();
    await repo.deleteResults(ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
