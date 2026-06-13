import { NextResponse } from "next/server";
import {
  appendRegisteredAccounts,
  deleteLegacyRegisteredAccount,
  deleteRegisteredAccount,
  readRegisteredAccounts,
  readRegistrationQueue,
} from "@/lib/services/registration-queue-store";

export const runtime = "nodejs";

export async function GET() {
  const [stored, queue] = await Promise.all([readRegisteredAccounts(), readRegistrationQueue()]);
  const storedKeys = new Set(stored.map((item) => `${item.url}|${item.email}|${item.username}`));
  const legacy = queue
    .filter((item) => item.username && item.password)
    .map((item) => ({
      url: item.url,
      email: item.email ?? "",
      username: item.username,
      password: item.password ?? "",
      note: item.note,
    }))
    .filter((item) => !storedKeys.has(`${item.url}|${item.email}|${item.username}`));
  const items = legacy.length > 0 ? await appendRegisteredAccounts(legacy) : stored;
  return NextResponse.json({ items });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }
  const result = id.startsWith("legacy-") ? await deleteLegacyRegisteredAccount(id) : await deleteRegisteredAccount(id);
  if (!result.deleted) {
    return NextResponse.json({ error: "Account không tồn tại." }, { status: 404 });
  }
  return NextResponse.json(result);
}
