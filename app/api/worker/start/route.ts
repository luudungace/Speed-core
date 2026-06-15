import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: string };
    const mode = body.mode === "direct" ? "direct" : "register";

    const workerPath = path.join(process.cwd(), "worker.js");

    // Spawn non-blocking detached process
    const child = spawn(process.execPath, [workerPath, `--mode=${mode}`], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
    });

    child.unref();

    return NextResponse.json({ ok: true, mode, pid: child.pid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
