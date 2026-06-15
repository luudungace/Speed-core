import { NextResponse } from "next/server";
import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  props: { params: Promise<{ jobId: string }> }
) {
  const params = await props.params;
  const jobId = params.jobId;
  try {
    const repo = new BacklinkOpportunityRepository();
    const job = await repo.getJob(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, error: "Tiến trình quét không tồn tại." }, { status: 404 });
    }

    const logs = await repo.getJobLogs(jobId);

    return NextResponse.json({
      ok: true,
      data: {
        job,
        logs,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Lỗi khi lấy thông tin tiến trình quét." }, { status: 500 });
  }
}
