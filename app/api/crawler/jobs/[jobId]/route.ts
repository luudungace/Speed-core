import { NextResponse } from "next/server";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const repo = new CrawlerRepository();
  const [job, logs] = await Promise.all([repo.getJob(jobId), repo.getJobLogs(jobId)]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job, logs });
}
