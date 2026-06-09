import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import { probeRegistrationUrl } from "@/lib/services/registration-probe";

export const runtime = "nodejs";

type ProbeRequest = {
  domain?: string;
  url?: string;
  cmsType?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProbeRequest;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const cmsType = typeof body.cmsType === "string" && body.cmsType.trim() ? body.cmsType.trim() : "Unknown";

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs are supported" }, { status: 400 });
    }

    const domain = typeof body.domain === "string" && body.domain.trim()
      ? body.domain.trim().replace(/^www\./, "")
      : parsedUrl.hostname.replace(/^www\./, "");

    const probe = await probeRegistrationUrl(url);
    const repo = new RegistrationRepository();

    try {
      const row = await repo.recordProbe({ domain, url, cmsType, probe });

      if (!probe.ok) {
        await repo.createReviewJob({
          domain,
          targetUrl: url,
          state: "manual_review",
          metadata: {
            source: "probe",
            failure_code: probe.failureCode,
            evidence: probe.evidence,
          },
        });
      }

      return NextResponse.json({ ok: true, saved: true, probe, row });
    } catch (saveError) {
      const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
      return NextResponse.json({
        ok: true,
        saved: false,
        warning: saveMessage.includes("registration_")
          ? "Probe da chay, nhung chua luu duoc vi migration registration chua duoc apply trong Supabase."
          : saveMessage,
        probe,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
