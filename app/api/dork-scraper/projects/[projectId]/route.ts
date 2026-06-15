import { NextResponse } from "next/server";
import { DorkScraperRepository } from "@/lib/repositories/dork-scraper-repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const repo = new DorkScraperRepository();

  try {
    const project = await repo.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const jobs = await repo.listJobs(projectId, 10);

    return NextResponse.json({
      project,
      jobs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
