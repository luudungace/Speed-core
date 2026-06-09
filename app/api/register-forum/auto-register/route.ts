import { NextResponse } from "next/server";
import { registerOwnedSiteAccount } from "@/lib/services/owned-site-registration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: string;
      registerUrl?: string;
      cmsType?: string;
    };

    const domain = body.domain?.trim();
    const registerUrl = body.registerUrl?.trim();
    if (!domain || !registerUrl) {
      return NextResponse.json({ ok: false, error: "Missing domain/registerUrl." }, { status: 400 });
    }

    try {
      const parsed = new URL(registerUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ ok: false, error: "Register URL phai la http/https." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Register URL khong hop le." }, { status: 400 });
    }

    const result = await registerOwnedSiteAccount({
      domain,
      registerUrl,
      cmsType: body.cmsType,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: mapError(message) }, { status: 500 });
  }
}

function mapError(message: string) {
  if (message.includes("owned_site_domains")) {
    return "Chua apply migration 006_owned_site_domains.sql hoac domain chua duoc them vao allowlist.";
  }
  if (message.includes("email_pool")) {
    return "Chua apply migration 005_resource_pools.sql hoac Email Pool chua co email available.";
  }
  if (message.includes("registration_accounts")) {
    return "Chua apply migration 004_registration_accounts.sql nen chua luu duoc ket qua account.";
  }
  if (message.includes("resource_pool_status")) {
    return "Chua apply migration 007_email_pool_used_status.sql nen chua danh dau email used duoc.";
  }
  return message;
}
