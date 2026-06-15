import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const repo = new RegistrationRepository();
    const data = await repo.listCandidates(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 20
    );

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ rows: [], count: 0, error: msg }, { status: 500 });
  }
}
