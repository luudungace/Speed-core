import { NextResponse } from "next/server";
import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  const projectId = params.projectId;
  try {
    const repo = new BacklinkOpportunityRepository();
    const project = await repo.getProject(projectId);
    if (!project) {
      return NextResponse.json({ ok: false, error: "Dự án không tồn tại." }, { status: 404 });
    }

    const competitors = await repo.listCompetitors(projectId);
    const recentJobs = await repo.listJobs(projectId, 10);

    return NextResponse.json({
      ok: true,
      data: {
        project,
        competitors: competitors.map((c) => c.domain),
        recentJobs,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Lỗi khi lấy thông tin chi tiết dự án." }, { status: 500 });
  }
}
