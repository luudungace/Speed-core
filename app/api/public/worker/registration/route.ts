import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";

export const runtime = "nodejs";

// Pull next job (FIFO) and lock resources
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    
    const repo = new RegistrationRepository();

    if (jobId) {
      const { data, error } = await repo.getJobById(jobId);
      if (error) throw error;
      return NextResponse.json({ ok: true, job: data });
    }

    const isDirectParam = searchParams.get("isDirect");
    const isDirect = isDirectParam !== null ? isDirectParam === "true" : null;

    const task = await repo.pullNextJobForWorker(isDirect);

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Report success or failure
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobId?: string;
      status?: "success" | "failed";
      username?: string;
      password?: string;
      emailUsed?: string;
      proxyUsed?: string;
      error?: string;
    };

    if (!body.jobId || !body.status || !body.emailUsed) {
      return NextResponse.json({ error: "Thiếu thông tin báo cáo kết quả (jobId, status, emailUsed)" }, { status: 400 });
    }

    const repo = new RegistrationRepository();
    await repo.reportJobResult(body.jobId, {
      status: body.status,
      username: body.username,
      password: body.password,
      emailUsed: body.emailUsed,
      proxyUsed: body.proxyUsed,
      error: body.error,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
