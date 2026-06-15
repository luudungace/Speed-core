import { NextResponse } from "next/server";
import { DorkScraperRepository } from "@/lib/repositories/dork-scraper-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId parameter" }, { status: 400 });
  }

  const search = searchParams.get("search") || undefined;
  const cmsType = searchParams.get("cmsType") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const repo = new DorkScraperRepository();

  try {
    const data = await repo.listDiscoveredForums({
      projectId,
      search,
      cmsType,
      status,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get("ids");
    if (!idStr) {
      return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
    }

    const ids = idStr.split(",");
    const repo = new DorkScraperRepository();
    await repo.deleteDiscoveredForums(ids);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
