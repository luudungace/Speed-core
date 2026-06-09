import { NextResponse } from "next/server";
import { ResourceRepository } from "@/lib/repositories/resource-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const repo = new ResourceRepository();
    const data = await repo.listPersonas(
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
      displayName?: string;
      usernameBase?: string;
      bio?: string | null;
      gender?: string | null;
      country?: string | null;
    };

    if (!body.displayName?.trim() || !body.usernameBase?.trim()) {
      return NextResponse.json({ error: "Display name và Username base không được để trống" }, { status: 400 });
    }

    const repo = new ResourceRepository();
    const persona = await repo.addPersona({
      displayName: body.displayName.trim(),
      usernameBase: body.usernameBase.trim(),
      bio: body.bio || null,
      gender: body.gender || null,
      country: body.country || null,
    });

    return NextResponse.json({ ok: true, persona });
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
      return NextResponse.json({ error: "Không có danh sách Persona cần xóa" }, { status: 400 });
    }

    const repo = new ResourceRepository();
    await repo.deletePersonas(ids);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
