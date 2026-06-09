import { NextResponse } from "next/server";
import { ResourceRepository } from "@/lib/repositories/resource-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const repo = new ResourceRepository();
    const data = await repo.listEmails(
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
    const body = (await request.json()) as { bulkText?: string; imapHost?: string; imapPort?: number };
    const bulkText = body.bulkText?.trim();
    if (!bulkText) {
      return NextResponse.json({ error: "Nội dung nạp trống" }, { status: 400 });
    }

    const repo = new ResourceRepository();
    const count = await repo.addEmailsBulk(bulkText, body.imapHost || "imap.gmail.com", Number(body.imapPort) || 993);

    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Không có danh sách email cần xóa" }, { status: 400 });
    }

    const repo = new ResourceRepository();
    await repo.deleteEmails(ids);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Không có danh sách email cần mở khóa" }, { status: 400 });
    }

    const repo = new ResourceRepository();
    await repo.unlockEmails(ids);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
