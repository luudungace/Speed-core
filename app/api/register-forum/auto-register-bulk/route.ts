import { NextResponse } from "next/server";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import { registerOwnedSiteAccount } from "@/lib/services/owned-site-registration";
import { getAuthLinks } from "@/lib/utils/auth-links";

export const runtime = "nodejs";

type BulkCandidate = {
  domain?: string;
  registerUrl?: string;
  cmsType?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { candidates?: BulkCandidate[] };
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const normalized = candidates
      .map((candidate) => ({
        domain: normalizeDomain(candidate.domain ?? ""),
        registerUrl: candidate.registerUrl?.trim() ?? "",
        cmsType: candidate.cmsType?.trim() || "Unknown",
      }))
      .filter((candidate) => candidate.domain && isHttpUrl(candidate.registerUrl));

    if (normalized.length === 0) {
      return NextResponse.json({ ok: false, error: "Khong co ung vien hop le de dang ky." }, { status: 400 });
    }

    const repo = new RegistrationRepository();
    await repo.deleteAllAccounts();

    const results: Array<{ domain: string; registerUrl: string; ok: boolean; message: string }> = [];
    const accountSaveErrors: string[] = [];

    for (const candidate of uniqueByRegisterUrl(normalized).slice(0, 2000)) {
      try {
        await repo.upsertOwnedDomain({
          domain: candidate.domain,
          label: "Crawler URL",
          notes: `Auto-added from register URL: ${candidate.registerUrl}`,
          enabled: true,
        });

        const result = await registerOwnedSiteAccount({
          domain: candidate.domain,
          registerUrl: candidate.registerUrl,
          cmsType: candidate.cmsType,
        });
        results.push({ domain: candidate.domain, registerUrl: candidate.registerUrl, ok: true, message: result.message });
      } catch (error) {
        const message = mapError(errorToMessage(error));
        const saveError = await saveFailedAccount(repo, {
          domain: candidate.domain,
          registerUrl: candidate.registerUrl,
          cmsType: candidate.cmsType,
          message,
        });
        if (saveError) accountSaveErrors.push(saveError);
        results.push({
          domain: candidate.domain,
          registerUrl: candidate.registerUrl,
          ok: false,
          message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: results.length,
      success: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      accountSaveFailed: accountSaveErrors.length,
      accountSaveError: accountSaveErrors[0] ?? null,
      results,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: mapError(errorToMessage(error)) }, { status: 500 });
  }
}

async function saveFailedAccount(
  repo: RegistrationRepository,
  input: { domain: string; registerUrl: string; cmsType: string; message: string },
) {
  try {
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
    return null;
  } catch (error) {
    return mapError(errorToMessage(error));
  }
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

function normalizeDomain(input: string) {
  return input.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

function isHttpUrl(input: string) {
  try {
    const url = new URL(input);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function uniqueByRegisterUrl<T extends { registerUrl: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrlKey(item.registerUrl);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function mapError(message: string) {
  if (message.includes("schema cache") && message.includes("registration_accounts")) {
    return "Supabase da co migration nhung PostgREST schema cache chua thay registration_accounts. Hay chay NOTIFY pgrst, 'reload schema'; trong SQL Editor hoac apply lai migration 004.";
  }
  if (message.includes("schema cache") && message.includes("owned_site_domains")) {
    return "Supabase da co migration nhung PostgREST schema cache chua thay owned_site_domains. Hay chay NOTIFY pgrst, 'reload schema'; trong SQL Editor hoac doi 1-2 phut roi thu lai.";
  }
  if (message.includes("owned_site_domains")) {
    return "Chua apply migration 006_owned_site_domains.sql.";
  }
  if (message.includes("email_pool")) {
    return "Chua apply migration 005_resource_pools.sql hoac Email Pool khong co email available.";
  }
  if (message.includes("registration_accounts")) {
    return "Chua apply migration 004_registration_accounts.sql nen chua luu duoc ket qua account.";
  }
  if (message.includes("resource_pool_status")) {
    return "Chua apply migration 007_email_pool_used_status.sql.";
  }
  return message;
}
