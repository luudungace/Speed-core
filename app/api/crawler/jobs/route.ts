import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const repo = new CrawlerRepository();
    const jobs = await repo.listJobs(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20);
    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ jobs: [], error: message }, { status: 500 });
  }
}
