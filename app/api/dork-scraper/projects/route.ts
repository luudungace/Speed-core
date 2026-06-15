import { NextResponse } from "next/server";
import { DorkScraperRepository } from "@/lib/repositories/dork-scraper-repository";

export const runtime = "nodejs";

export async function GET() {
  const repo = new DorkScraperRepository();
  try {
    const projects = await repo.listProjects();
    return NextResponse.json(projects);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
