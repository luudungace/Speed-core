import { NextResponse } from "next/server";
import { registerForumAccount } from "@/lib/services/forum-registration-service";
import { appendRegisteredAccounts, upsertRegistrationQueueItems } from "@/lib/services/registration-queue-store";
import { readEmailPool } from "@/lib/services/resource-store";
import { normalizeVietnameseText } from "@/lib/utils/text-normalize";

export const runtime = "nodejs";

type RequestEmail = {
  email?: string;
  status?: string;
};

type RequestItem = {
  url?: string;
  email?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: RequestItem[];
      emailPool?: RequestEmail[];
      limit?: number;
    };

    const storedEmailPool = await readEmailPool();
    const emailPool = storedEmailPool
      .filter((item) => item.status !== "locked")
      .map((item) => item.email);

    const limit = Math.max(1, Math.min(20, Number(body.limit) || 5));
    const items = (body.items ?? [])
      .filter((item) => typeof item.url === "string" && /^https?:\/\//i.test(item.url))
      .slice(0, limit);

    if (items.length === 0) {
      return NextResponse.json({ results: [], error: "Không có URL hợp lệ để đăng ký." }, { status: 400 });
    }
    if (emailPool.length === 0) {
      return NextResponse.json({ results: [], error: "Không có email khả dụng trong Email Pool." }, { status: 400 });
    }

    const results = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const email = emailPool[index % emailPool.length];
      if (!email) continue;
      try {
        await upsertRegistrationQueueItems([
          {
            url: item.url as string,
            title: null,
            rating: "",
            score: 0,
            siteType: "",
            email,
            username: "",
            status: "Đang chạy",
          },
        ]);
        results.push(await registerForumAccount({ url: item.url as string, email }));
      } catch (error) {
        results.push({
          url: item.url as string,
          email,
          username: "",
          password: "",
          status: "Không đăng ký được",
          note: error instanceof Error ? error.message : "Unknown registration error",
        });
      }
    }

    const isSuccessfulResult = (result: { status: string; username?: string; password?: string }) => {
      const status = normalizeVietnameseText(result.status).normalize("NFC").toLowerCase();
      return Boolean(result.username && result.password && status === "đăng ký được");
    };

    const normalizedResults = results.map((result) => ({
      ...result,
      status: normalizeVietnameseText(result.status),
      note: normalizeVietnameseText(result.note),
    }));

    await upsertRegistrationQueueItems(
      normalizedResults.map((result) => ({
        url: result.url,
        title: null,
        rating: "",
        score: 0,
        siteType: "",
        email: result.email,
        username: isSuccessfulResult(result) ? result.username : "",
        password: isSuccessfulResult(result) ? result.password : "",
        status: result.status,
        note: result.note,
      })),
    );

    await appendRegisteredAccounts(
      normalizedResults
        .filter((result) => isSuccessfulResult(result))
        .map((result) => ({
          url: result.url,
          email: result.email,
          username: result.username,
          password: result.password,
          note: result.note,
        })),
    );

    return NextResponse.json({ results: normalizedResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ results: [], error: message }, { status: 500 });
  }
}
