import { NextResponse } from "next/server";
import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repo = new BacklinkOpportunityRepository();
    const projects = await repo.listProjects();
    return NextResponse.json({ ok: true, data: projects });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Lỗi khi lấy danh sách dự án." }, { status: 500 });
  }
}
