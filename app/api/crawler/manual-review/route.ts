import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = new CrawlerRepository();
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");

    const data = await repo.listManualReviewResults({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      search: searchParams.get("search") ?? "",
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: message }, { status: 500 });
  }
}
