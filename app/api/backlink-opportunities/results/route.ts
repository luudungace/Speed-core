import { NextResponse } from "next/server";
import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Thiếu projectId." }, { status: 400 });
    }

    const repo = new BacklinkOpportunityRepository();
    
    const search = searchParams.get("search") || undefined;
    const siteType = searchParams.get("siteType") || undefined;
    const cmsType = searchParams.get("cmsType") || undefined;
    
    const minScoreStr = searchParams.get("minScore");
    const minScore = minScoreStr ? parseInt(minScoreStr, 10) : undefined;
    
    const minCompCountStr = searchParams.get("minCompetitorCount");
    const minCompetitorCount = minCompCountStr ? parseInt(minCompCountStr, 10) : undefined;
    
    const hasRegistration = searchParams.get("hasRegistration") === "true";
    const hasSubmit = searchParams.get("hasSubmit") === "true";
    const hasProfile = searchParams.get("hasProfile") === "true";
    
    const pageStr = searchParams.get("page");
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    
    const pageSizeStr = searchParams.get("pageSize");
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

    const results = await repo.listOpportunities({
      projectId,
      search,
      siteType,
      cmsType,
      minScore,
      minCompetitorCount,
      hasRegistration,
      hasSubmit,
      hasProfile,
      page,
      pageSize,
    });

    return NextResponse.json({ ok: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Lỗi khi lấy kết quả cơ hội." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Danh sách ids không hợp lệ." }, { status: 400 });
    }

    const repo = new BacklinkOpportunityRepository();
    await repo.deleteOpportunities(ids);
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Lỗi khi xóa kết quả phân tích." }, { status: 500 });
  }
}
