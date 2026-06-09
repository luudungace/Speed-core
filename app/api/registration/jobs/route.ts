import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    const status = searchParams.get("status") || undefined;
    const isDirectParam = searchParams.get("isDirect");
    const isDirect = isDirectParam !== null ? isDirectParam === "true" : undefined;
    const hasAccountParam = searchParams.get("hasAccount");
    const hasAccount = hasAccountParam !== null ? hasAccountParam === "true" : undefined;

    const repo = new RegistrationRepository();
    const data = await repo.listJobs(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 20,
      status,
      isDirect,
      hasAccount
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
      urls?: string[];
      url?: string;
      cmsType?: string;
      username?: string;
      password?: string;
      jobs?: Array<{
        url: string;
        cmsType: string;
        username?: string;
        password?: string;
      }>;
    };

    const repo = new RegistrationRepository();

    // 1. Nhập hàng loạt tài nguyên tài khoản có sẵn
    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      const addedJobs = [];
      for (const item of body.jobs) {
        if (item.url && item.cmsType) {
          const job = await repo.addDirectJob({
            url: item.url,
            cmsType: item.cmsType,
            username: item.username || undefined,
            password: item.password || undefined,
          });
          addedJobs.push(job);
        }
      }
      return NextResponse.json({ ok: true, count: addedJobs.length, jobs: addedJobs });
    }

    // 2. Nhập đơn lẻ một tài khoản có sẵn
    if (body.url && body.cmsType) {
      const job = await repo.addDirectJob({
        url: body.url,
        cmsType: body.cmsType,
        username: body.username,
        password: body.password,
      });
      return NextResponse.json({ ok: true, count: 1, job });
    }

    // 3. Enqueue các ứng viên từ danh sách URL cào
    const urls = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "Không có danh sách dữ liệu hợp lệ để xử lý" }, { status: 400 });
    }

    const count = await repo.enqueueJobs(urls);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID của job cần xóa" }, { status: 400 });
    }

    const repo = new RegistrationRepository();
    await repo.deleteJob(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID của job" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const repo = new RegistrationRepository();

    if (body.action === "manual_done") {
      await repo.updateJobError(id, "MANUAL_REGISTRATION_DONE");
      return NextResponse.json({ ok: true });
    }

    await repo.requeueJob(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

