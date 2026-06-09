"use server";

import { revalidatePath } from "next/cache";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import { getCrawlerRegisterLink } from "@/lib/utils/auth-links";

type CrawlerRegisterSyncInput = {
  search?: string;
  cms?: string;
  statusFilter?: string;
  urlDepth?: string;
  resultJobId?: string | null;
};

export async function enqueueManualReviewAction(input: {
  domain: string;
  targetUrl: string;
  source?: string;
}) {
  try {
    const repo = new RegistrationRepository();
    await repo.createReviewJob({
      domain: input.domain,
      targetUrl: input.targetUrl,
      state: "manual_review",
      metadata: {
        source: input.source ?? "manual",
      },
    });
    revalidatePath("/register-forum");
    return { ok: true };
  } catch (error) {
    const message = errorToMessage(error);
    return {
      ok: false,
      error: message.includes("registration_")
        ? "Chua apply migration registration trong Supabase nen chua luu duoc review job."
        : message,
    };
  }
}

export async function syncRegistrationCandidatesAction(input: CrawlerRegisterSyncInput = {}) {
  try {
    const crawlerRepo = new CrawlerRepository();
    const registrationRepo = new RegistrationRepository();
    const { rows } = await crawlerRepo.listResults({
      pageSize: 2000,
      search: input.search ?? "",
      cms: input.cms ?? "All CMS",
      status: parseStatusFilter(input.statusFilter),
      registerFilter: "with",
      urlDepth: input.urlDepth ?? "Táº¥t cáº£ URL",
      jobId: input.resultJobId ?? undefined,
      dedupeByDomain: false,
    });
    const candidates = uniqueByUrl(
      rows
      .map((row) => {
        const registerUrl = getCrawlerRegisterLink({
          url: row.url,
          domain: row.domain,
          cmsType: row.cms_type,
        });

        return {
          row,
          registerUrl,
        };
      })
      .filter((item) => item.registerUrl)
      .map(({ row, registerUrl }) => ({
        domain: row.domain,
        url: registerUrl,
        cmsType: row.cms_type,
        score: row.cms_type === "Unknown" ? 85 : 90,
        status: "verified" as const,
        evidence: {
          source: "crawler_register_column",
          reason: `Synced from Crawler URL Register column: ${registerUrl}`,
          sourceUrl: row.url,
        },
      })),
    );

    await registrationRepo.deleteAllUrls();
    const saved = await registrationRepo.upsertCandidates(candidates);
    revalidatePath("/register-forum");
    return { ok: true, count: saved.length };
  } catch (error) {
    const message = errorToMessage(error);
    return {
      ok: false,
      count: 0,
      error: message.includes("registration_")
        ? "Chua apply migration registration trong Supabase nen chua sync duoc candidate."
        : message,
    };
  }
}

function parseStatusFilter(value: string | undefined) {
  return value === "success" || value === "other" ? value : undefined;
}

function uniqueByUrl<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrlKey(item.url);
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
      return "Loi khong xac dinh.";
    }
  }
  return "Loi khong xac dinh.";
}

export async function saveRegistrationAccountAction(input: {
  domain: string;
  registerUrl?: string;
  loginUrl: string;
  accountEmail: string;
  username?: string;
  passwordValue: string;
  notes?: string;
}) {
  try {
    const domain = input.domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const loginUrl = input.loginUrl.trim();
    const accountEmail = input.accountEmail.trim();
    const passwordValue = input.passwordValue.trim();

    if (!domain || !loginUrl || !accountEmail || !passwordValue) {
      return { ok: false, error: "Domain, login URL, email va password la bat buoc." };
    }

    try {
      const parsed = new URL(loginUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { ok: false, error: "Login URL phai la http/https." };
      }
    } catch {
      return { ok: false, error: "Login URL khong hop le." };
    }

    const repo = new RegistrationRepository();
    await repo.createAccount({
      domain,
      registerUrl: input.registerUrl?.trim() || null,
      loginUrl,
      accountEmail,
      username: input.username?.trim() || null,
      passwordValue,
      status: "manual_saved",
      notes: input.notes?.trim() || null,
    });
    revalidatePath("/register-forum");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message.includes("registration_accounts")
        ? "Chua apply migration 004_registration_accounts.sql trong Supabase nen chua luu duoc account."
        : message,
    };
  }
}

export async function addOwnedDomainAction(input: {
  domain: string;
  label?: string;
  notes?: string;
}) {
  try {
    const domain = input.domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!domain) return { ok: false, error: "Domain la bat buoc." };

    const repo = new RegistrationRepository();
    await repo.upsertOwnedDomain({
      domain,
      label: input.label?.trim() || null,
      notes: input.notes?.trim() || null,
      enabled: true,
    });
    revalidatePath("/register-forum");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message.includes("owned_site_domains")
        ? "Chua apply migration 005_owned_sites_and_resources.sql trong Supabase nen chua luu duoc owned domain."
        : message,
    };
  }
}

export async function hideRegistrationUrlAction(input: {
  domain: string;
  url: string;
  cmsType?: string;
}) {
  try {
    const domain = input.domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const url = input.url.trim();
    if (!domain || !url) return { ok: false, error: "Domain va URL la bat buoc." };

    const repo = new RegistrationRepository();
    await repo.hideUrl({
      domain,
      url,
      cmsType: input.cmsType?.trim() || "Unknown",
    });
    revalidatePath("/register-forum");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message.includes("registration_urls")
        ? "Chua apply migration 003_registration_pipeline.sql trong Supabase nen chua xoa/an duoc URL."
        : message,
    };
  }
}
