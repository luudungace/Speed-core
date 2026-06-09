import { randomUUID } from "crypto";
import { chromium, type Locator, type Page } from "playwright";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { RegistrationAccountRow } from "@/lib/types/registration";
import { getAuthLinks } from "@/lib/utils/auth-links";

type EmailPoolSecretRow = {
  id: string;
  email: string;
  password_value: string;
};

type UserPoolSecretRow = {
  id: string;
  username: string;
};

type RegistrationStage =
  | "owned_domain"
  | "email_pool"
  | "user_pool"
  | "browser"
  | "navigate"
  | "form_detect"
  | "form_submit"
  | "account_save";

export type OwnedSiteRegistrationResult = {
  account: RegistrationAccountRow;
  finalUrl: string;
  message: string;
};

class RegistrationStageError extends Error {
  constructor(
    readonly stage: RegistrationStage,
    readonly code: string,
    message: string,
  ) {
    super(`[${stage}/${code}] ${message}`);
    this.name = "RegistrationStageError";
  }
}

function stageError(stage: RegistrationStage, code: string, message: string) {
  return new RegistrationStageError(stage, code, message);
}

function normalizeDomain(input: string) {
  return input.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
}

function makeUsername(email: string) {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 18) || "speedcore";
  return `${base}_${Math.floor(100 + Math.random() * 900)}`;
}

async function assertOwnedDomain(domain: string) {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("owned_site_domains")
    .select("id")
    .eq("domain", domain)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw stageError("owned_domain", "not_authorized", "Domain chua nam trong owned_site_domains hoac dang disabled.");
  }
}

async function lockEmailForJob(jobId: string) {
  const db = createSupabaseAdmin();
  const { data: email, error: selectError } = await db
    .from("email_pool")
    .select("id,email,password_value")
    .eq("status", "available")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!email) throw stageError("email_pool", "empty", "Email Pool khong co email available.");

  const row = email as EmailPoolSecretRow;
  const { error: updateError } = await db
    .from("email_pool")
    .update({
      status: "locked",
      locked_by: jobId,
      locked_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "available");
  if (updateError) throw updateError;
  return row;
}

async function releaseEmail(emailId: string, status: "available" | "used") {
  const db = createSupabaseAdmin();
  const { error } = await db
    .from("email_pool")
    .update({
      status,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: status === "used" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);
  if (error) throw error;
}

async function lockUserForJob(jobId: string) {
  const db = createSupabaseAdmin();
  const { data: user, error: selectError } = await db
    .from("user_pool")
    .select("id,username")
    .eq("status", "available")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) {
    if (selectError.message.includes("user_pool")) return null;
    throw stageError("user_pool", "select_failed", selectError.message);
  }
  if (!user) return null;

  const row = user as UserPoolSecretRow;
  const { error: updateError } = await db
    .from("user_pool")
    .update({
      status: "locked",
      locked_by: jobId,
      locked_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "available");
  if (updateError) throw updateError;
  return row;
}

async function releaseUser(userId: string, status: "available" | "used") {
  const db = createSupabaseAdmin();
  const { error } = await db
    .from("user_pool")
    .update({
      status,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: status === "used" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

async function fillFirst(locator: Locator, value: string) {
  if ((await locator.count()) === 0) return false;
  await locator.first().fill(value, { timeout: 5000 });
  return true;
}

function emailField(page: Page) {
  return page.locator(
    [
      'input[type="email"]',
      'input[autocomplete="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[name*="mail" i]',
      'input[id*="mail" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="mail" i]',
    ].join(", "),
  );
}

function usernameField(page: Page) {
  return page.locator(
    [
      'input[autocomplete="username"]',
      'input[name="user_login"]',
      'input[id="user_login"]',
      'input[name*="user" i]',
      'input[id*="user" i]',
      'input[name*="login" i]',
      'input[id*="login" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="username" i]',
    ].join(", "),
  );
}

function passwordField(page: Page) {
  return page.locator(
    [
      'input[type="password"]',
      'input[autocomplete="new-password"]',
      'input[name*="pass" i]',
      'input[id*="pass" i]',
      'input[placeholder*="password" i]',
    ].join(", "),
  );
}

function submitControl(page: Page) {
  return page
    .locator(
      [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Register")',
        'button:has-text("Sign up")',
        'button:has-text("Create account")',
        'button:has-text("Dang ky")',
        'form button',
      ].join(", "),
    )
    .last();
}

export async function registerOwnedSiteAccount(input: {
  domain: string;
  registerUrl: string;
  cmsType?: string;
}): Promise<OwnedSiteRegistrationResult> {
  const domain = normalizeDomain(input.domain);
  await assertOwnedDomain(domain);

  const jobId = randomUUID();
  const email = await lockEmailForJob(jobId);
  const accountPassword = email.password_value;
  const pooledUser = await lockUserForJob(jobId);
  const username = pooledUser?.username ?? makeUsername(email.email);
  const loginUrl = getAuthLinks({ url: input.registerUrl, domain, cmsType: input.cmsType }).login;

  const browser = await chromium.launch({ headless: true }).catch((error) => {
    throw stageError("browser", "launch_failed", error instanceof Error ? error.message : String(error));
  });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });
    await page.goto(input.registerUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((error) => {
      throw stageError("navigate", "open_failed", error instanceof Error ? error.message : String(error));
    });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);

    const emailFilled = await fillFirst(emailField(page), email.email);
    const passwordFields = passwordField(page);
    const passwordCount = await passwordFields.count();
    for (let index = 0; index < Math.min(passwordCount, 2); index += 1) {
      await passwordFields.nth(index).fill(accountPassword, { timeout: 5000 });
    }
    const usernameFilled = await fillFirst(usernameField(page), username).catch(() => false);

    if (!emailFilled) {
      throw stageError("form_detect", "missing_email_field", "Khong tim thay field email tren form dang ky.");
    }

    const submit = submitControl(page);
    if ((await submit.count()) === 0) {
      throw stageError("form_detect", "missing_submit", "Khong tim thay nut submit tren form dang ky.");
    }
    await submit.click({ timeout: 5000 }).catch((error) => {
      throw stageError("form_submit", "click_failed", error instanceof Error ? error.message : String(error));
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const missingPasswordMeansMailFlow = passwordCount === 0;
    const needsVerification =
      missingPasswordMeansMailFlow ||
      /verify|verification|confirm|confirmation|activate|activation|check your email|confirm your email|kiem tra email|xac minh email/i.test(bodyText);
    const submissionLooksFailed =
      /captcha|invalid|required|already exists|already registered|error|failed|not allowed|forbidden|too many/i.test(bodyText) &&
      !needsVerification;

    if (submissionLooksFailed) {
      throw stageError("form_submit", "response_error", bodyText.slice(0, 300) || "Site tra ve loi sau khi submit.");
    }

    const db = createSupabaseAdmin();
    const { data: account, error } = await db
      .from("registration_accounts")
      .insert({
        domain,
        register_url: input.registerUrl,
        login_url: loginUrl,
        account_email: email.email,
        username,
        password_value: accountPassword,
        status: needsVerification ? "needs_verification" : "active",
        notes: missingPasswordMeansMailFlow
          ? "Form khong co password field; site co ve dang gui email xac minh/dat mat khau."
          : null,
        metadata: {
          source: "owned_site_auto_register",
          cms_type: input.cmsType ?? "Unknown",
          final_url: page.url(),
          username_filled: usernameFilled,
          password_fields: passwordCount,
          needs_verification: needsVerification,
          response_snippet: bodyText.slice(0, 500),
        },
      })
      .select("*")
      .single();
    if (error) throw stageError("account_save", "insert_failed", error.message);

    await releaseEmail(email.id, "used");
    if (pooledUser) await releaseUser(pooledUser.id, "used");
    return {
      account: account as RegistrationAccountRow,
      finalUrl: page.url(),
      message: needsVerification
        ? "Da submit form dang ky. Site co ve yeu cau xac minh email; tool se khong tu mo mail."
        : "Da submit form dang ky va luu account vao danh sach.",
    };
  } catch (error) {
    await releaseEmail(email.id, "available").catch(() => undefined);
    if (pooledUser) await releaseUser(pooledUser.id, "available").catch(() => undefined);
    throw error;
  } finally {
    await browser.close();
  }
}
