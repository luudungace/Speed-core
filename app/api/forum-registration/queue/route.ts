import { NextResponse } from "next/server";
import {
  readRegistrationQueue,
  type StoredRegistrationQueueItem,
  writeRegistrationQueue,
} from "@/lib/services/registration-queue-store";
import { readEmailPool } from "@/lib/services/resource-store";

export const runtime = "nodejs";

async function sanitizeQueueEmails(items: StoredRegistrationQueueItem[]) {
  const emailPool = await readEmailPool();
  const validEmails = new Set(emailPool.filter((item) => item.status !== "locked").map((item) => item.email));
  return items.map((item) => {
    const email = item.email?.toLowerCase().trim() ?? null;
    if (!email || !validEmails.has(email)) {
      return {
        ...item,
        email: null,
        note: item.email ? "Email cũ không còn nằm trong Email Pool khả dụng, đã bỏ gán email." : item.note,
      };
    }
    return { ...item, email };
  });
}

export async function GET() {
  const items = await sanitizeQueueEmails(await readRegistrationQueue());
  await writeRegistrationQueue(items);
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { items?: StoredRegistrationQueueItem[] };
  const items = await sanitizeQueueEmails(
    (body.items ?? []).filter((item) => typeof item.url === "string" && /^https?:\/\//i.test(item.url)),
  );
  await writeRegistrationQueue(items);
  return NextResponse.json({ items });
}
