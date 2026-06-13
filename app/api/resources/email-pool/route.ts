import { NextResponse } from "next/server";
import { readEmailPool, type StoredEmailResource, writeEmailPool } from "@/lib/services/resource-store";

export const runtime = "nodejs";

export async function GET() {
  const items = await readEmailPool();
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { items?: StoredEmailResource[] };
  const items = (body.items ?? []).filter((item) => typeof item.email === "string" && item.email.includes("@"));
  const saved = await writeEmailPool(items);
  return NextResponse.json({ items: saved });
}
