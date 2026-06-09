import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { BacklinkRepository } from "@/lib/repositories/backlink-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repo = new BacklinkRepository();
    const rows = await repo.getAllBacklinksForExport();

    const sheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        "ID": row.id,
        "Diễn đàn": row.forum_url,
        "Link bài đăng": row.posted_url,
        "Trạng thái": row.status,
        "Đăng lúc": row.posted_at || row.created_at,
        "Chi tiết": JSON.stringify(row.details ?? {}),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "backlinks");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="posted-backlinks.xlsx"',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
