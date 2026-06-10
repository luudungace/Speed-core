import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import { registerOwnedSiteAccount } from "@/lib/services/owned-site-registration";
import { getAuthLinks } from "@/lib/utils/auth-links";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let domain = "";
  let registerUrl = "";
  let cmsType = "Unknown";
  try {
    const body = (await request.json()) as {
      domain?: string;
      registerUrl?: string;
      cmsType?: string;
    };

    domain = normalizeDomain(body.domain ?? "");
    registerUrl = body.registerUrl?.trim() ?? "";
    cmsType = body.cmsType?.trim() || "Unknown";
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

    const repo = new RegistrationRepository();
    await repo.upsertOwnedDomain({
      domain,
      label: "Register Forum",
      notes: `Auto-added from register URL: ${registerUrl}`,
      enabled: true,
    });

    const result = await registerOwnedSiteAccount({
      domain,
      registerUrl,
      cmsType,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = mapError(errorToMessage(error));
    if (domain && registerUrl) {
      await saveFailedAccount({ domain, registerUrl, cmsType, message }).catch(() => undefined);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function saveFailedAccount(input: { domain: string; registerUrl: string; cmsType: string; message: string }) {
  const repo = new RegistrationRepository();
  const links = getAuthLinks({ url: input.registerUrl, domain: input.domain, cmsType: input.cmsType });
  await repo.createAccount({
    domain: input.domain,
    registerUrl: input.registerUrl,
    loginUrl: links.login,
    accountEmail: "-",
    username: null,
    passwordValue: "-",
    status: "failed",
    notes: input.message,
  });
}

function normalizeDomain(input: string) {
  return input.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(record);
    } catch {
      return "Loi khong doc duoc noi dung.";
    }
  }
  return String(error);
}

function mapError(message: string) {
  if (message.includes("owned_site_domains")) {
    return "Chua apply migration 006_owned_site_domains.sql hoac domain chua duoc them vao allowlist.";
  }
  if (message.includes("[email_pool/empty]")) {
    return "Email Pool da ton tai nhung khong co email nao co the dung. Hay them email moi hoac kiem tra email khong bi locked/invalid/disabled.";
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
