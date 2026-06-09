import { NextResponse } from "next/server";
import { BacklinkRepository } from "@/lib/repositories/backlink-repository";
import { GoogleSheetsService } from "@/lib/services/google-sheets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const repo = new BacklinkRepository();
    const data = await repo.listBacklinks(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 20
    );

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      forumUrl?: string;
      postedUrl?: string;
      status?: "success" | "failed";
      details?: Record<string, any>;
    };

    if (!body.forumUrl || !body.postedUrl) {
      return NextResponse.json({ error: "Thiếu thông tin backlink (forumUrl, postedUrl)" }, { status: 400 });
    }

    const repo = new BacklinkRepository();
    const backlink = await repo.addBacklink({
      forumUrl: body.forumUrl,
      postedUrl: body.postedUrl,
      status: body.status || "success",
      details: body.details,
    });

    // Automatically sync backlink info to Google Sheet in the background (Task 4.2)
    if (body.status === "success" || !body.status) {
      const sheetsService = new GoogleSheetsService();
      void sheetsService.syncBacklinkToGoogleSheet({
        forumUrl: body.forumUrl,
        postedUrl: body.postedUrl,
        username: String(body.details?.username || "auto_user"),
        emailUsed: String(body.details?.emailUsed || "common_email"),
      });
    }

    return NextResponse.json({ ok: true, backlink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
