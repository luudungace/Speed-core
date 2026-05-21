import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = new CrawlerRepository();
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const data = await repo.listResults({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    search: searchParams.get("search") ?? "",
    cms: searchParams.get("cms") ?? "All CMS",
  });

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const repo = new CrawlerRepository();
  await repo.deleteResults(ids);
  return NextResponse.json({ ok: true });
}
