import { NextResponse } from "next/server";
import { postForumBacklink } from "@/lib/services/forum-posting-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      url: string;
      username: string;
      password?: string;
      persona?: {
        displayName: string;
        bio?: string;
        country?: string;
      };
      cmsType?: string;
      isDirectLogin?: boolean;
    };

    if (!body.url || !body.username) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc: url, username" },
        { status: 400 }
      );
    }

    const result = await postForumBacklink({
      url: body.url,
      username: body.username,
      password: body.password,
      persona: body.persona ?? {
        displayName: body.username,
        bio: "SEO expert and tech enthusiast.",
        country: "US",
      },
      cmsType: body.cmsType,
      isDirectLogin: body.isDirectLogin ?? true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, postedUrl: result.postedUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi không xác định khi đăng bài." },
      { status: 500 }
    );
  }
}
