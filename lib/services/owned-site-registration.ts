import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { chromium, type Locator, type Page } from "playwright";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { RegistrationAccountRow } from "@/lib/types/registration";
import { getAuthLinks } from "@/lib/utils/auth-links";

type EmailPoolSecretRow = {
  id: string;
  email: string;
  password_value: string;
};

type PersonaPoolSecretRow = {
  id: string;
  display_name: string;
  username_base: string;
  bio: string | null;
  gender: string | null;
  country: string | null;
  source_table: "persona_pool" | "user_pool";
};

type ProxyPoolSecretRow = {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password_value: string | null;
};

type RegistrationStage =
  | "owned_domain"
  | "email_pool"
  | "persona_pool"
  | "proxy_pool"
  | "browser"
  | "navigate"
  | "form_detect"
  | "manual_review"
  | "form_submit"
  | "account_save";

export type OwnedSiteRegistrationResult = {
  account: RegistrationAccountRow;
  finalUrl: string;
  message: string;
  manualReviewOpened?: boolean;
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

function canOpenManualReview(error: unknown) {
  if (!(error instanceof RegistrationStageError)) return false;
  if (error.stage === "form_detect") {
    return ["missing_email_field", "missing_submit", "captcha_detected"].includes(error.code);
  }
  if (error.stage !== "form_submit") return false;
  if (error.code === "click_failed") return true;
  return /captcha|recaptcha|hcaptcha|required|missing|required field|please fill|field is required/i.test(error.message);
}

function openManualReviewUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const command =
      process.platform === "win32"
        ? { file: "cmd", args: ["/c", "start", "", parsed.toString()] }
        : process.platform === "darwin"
          ? { file: "open", args: [parsed.toString()] }
          : { file: "xdg-open", args: [parsed.toString()] };

    const child = spawn(command.file, command.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function isMissingPersonaTable(error: unknown) {
  const message = error instanceof Error ? error.message : error && typeof error === "object" ? JSON.stringify(error) : String(error);
  return message.includes("persona_pool") && /schema cache|Could not find the table|PGRST205/i.test(message);
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
    .in("status", ["available", "used"])
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!email) throw stageError("email_pool", "empty", "Email Pool khong co email available hoac used de tai su dung.");

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
    .in("status", ["available", "used"]);
  if (updateError) throw updateError;
  return row;
}

async function releaseEmail(emailId: string) {
  const db = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("email_pool")
    .update({
      status: "available",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", emailId);
  if (error) throw error;
}

async function lockPersonaForJob(jobId: string) {
  const db = createSupabaseAdmin();
  const { data: persona, error: selectError } = await db
    .from("persona_pool")
    .select("id,display_name,username_base,bio,gender,country")
    .in("status", ["available", "used"])
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) {
    if (isMissingPersonaTable(selectError)) return lockCompatPersonaForJob(jobId);
    throw stageError("persona_pool", "select_failed", selectError.message);
  }
  if (!persona) return null;

  const row = { ...(persona as Omit<PersonaPoolSecretRow, "source_table">), source_table: "persona_pool" as const };
  const { error: updateError } = await db
    .from("persona_pool")
    .update({
      status: "locked",
      locked_by: jobId,
      locked_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .in("status", ["available", "used"]);
  if (updateError) throw updateError;
  return row;
}

async function lockCompatPersonaForJob(jobId: string) {
  const db = createSupabaseAdmin();
  const { data: persona, error: selectError } = await db
    .from("user_pool")
    .select("id,username,display_name,metadata")
    .eq("metadata->>resource_kind", "persona")
    .in("status", ["available", "used"])
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) throw stageError("persona_pool", "compat_select_failed", selectError.message);
  if (!persona) return null;

  const raw = persona as {
    id: string;
    username: string;
    display_name: string | null;
    metadata: Record<string, unknown> | null;
  };
  const { error: updateError } = await db
    .from("user_pool")
    .update({
      status: "locked",
      locked_by: jobId,
      locked_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", raw.id)
    .in("status", ["available", "used"]);
  if (updateError) throw updateError;

  const metadata = raw.metadata ?? {};
  return {
    id: raw.id,
    display_name: raw.display_name ?? raw.username,
    username_base: raw.username,
    bio: typeof metadata.bio === "string" ? metadata.bio : null,
    gender: typeof metadata.gender === "string" ? metadata.gender : null,
    country: typeof metadata.country === "string" ? metadata.country : null,
    source_table: "user_pool" as const,
  };
}

async function releasePersona(personaId: string) {
  const db = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("persona_pool")
    .update({
      status: "available",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", personaId);
  if (error) throw error;
}

async function releaseCompatPersona(personaId: string) {
  const db = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("user_pool")
    .update({
      status: "available",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", personaId);
  if (error) throw error;
}

async function releaseLockedPersona(persona: PersonaPoolSecretRow) {
  if (persona.source_table === "user_pool") return releaseCompatPersona(persona.id);
  return releasePersona(persona.id);
}

async function lockProxyForJob(jobId: string) {
  const db = createSupabaseAdmin();
  const { data: proxy, error: selectError } = await db
    .from("proxy_pool")
    .select("id,host,port,username,password_value")
    .in("status", ["available", "used"])
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (selectError) {
    if (selectError.message.includes("proxy_pool")) return null;
    throw stageError("proxy_pool", "select_failed", selectError.message);
  }
  if (!proxy) return null;

  const row = proxy as ProxyPoolSecretRow;
  const { error: updateError } = await db
    .from("proxy_pool")
    .update({
      status: "locked",
      locked_by: jobId,
      locked_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .in("status", ["available", "used"]);
  if (updateError) throw updateError;
  return row;
}

async function releaseProxy(proxyId: string) {
  const db = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("proxy_pool")
    .update({
      status: "available",
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", proxyId);
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

function displayNameField(page: Page) {
  return page.locator(
    [
      'input[name*="display" i]',
      'input[id*="display" i]',
      'input[name*="full_name" i]',
      'input[id*="full_name" i]',
      'input[name*="fullname" i]',
      'input[id*="fullname" i]',
      'input[name*="name" i]',
      'input[id*="name" i]',
      'input[placeholder*="name" i]',
    ].join(", "),
  );
}

function bioField(page: Page) {
  return page.locator(
    [
      'textarea[name*="bio" i]',
      'textarea[id*="bio" i]',
      'textarea[name*="about" i]',
      'textarea[id*="about" i]',
      'textarea[name*="description" i]',
      'textarea[id*="description" i]',
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

async function hasCaptchaChallenge(page: Page) {
  const captchaLocator = page.locator(
    [
      'iframe[src*="recaptcha" i]',
      'iframe[src*="hcaptcha" i]',
      'div[class*="g-recaptcha" i]',
      'div[class*="h-captcha" i]',
      'input[name*="captcha" i]',
      'input[id*="captcha" i]',
      'textarea[name*="g-recaptcha-response" i]',
      'textarea[name*="h-captcha-response" i]',
    ].join(", "),
  );
  if ((await captchaLocator.count().catch(() => 0)) > 0) return true;

  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /captcha|recaptcha|hcaptcha|i'm not a robot|toi khong phai robot/i.test(bodyText);
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
  const persona = await lockPersonaForJob(jobId);
  const username = persona?.username_base ?? makeUsername(email.email);
  const proxy = await lockProxyForJob(jobId);
  const loginUrl = getAuthLinks({ url: input.registerUrl, domain, cmsType: input.cmsType }).login;
  let manualReviewUrl = input.registerUrl;

  const browser = await chromium.launch({
    headless: true,
    proxy: proxy
      ? {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.username ?? undefined,
          password: proxy.password_value ?? undefined,
        }
      : undefined,
  }).catch((error) => {
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
    manualReviewUrl = page.url();
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);

    const emailFilled = await fillFirst(emailField(page), email.email);
    const passwordFields = passwordField(page);
    const passwordCount = await passwordFields.count();
    for (let index = 0; index < Math.min(passwordCount, 2); index += 1) {
      await passwordFields.nth(index).fill(accountPassword, { timeout: 5000 });
    }
    const usernameFilled = await fillFirst(usernameField(page), username).catch(() => false);
    const displayNameFilled = persona
      ? await fillFirst(displayNameField(page), persona.display_name).catch(() => false)
      : false;
    const bioFilled = persona?.bio ? await fillFirst(bioField(page), persona.bio).catch(() => false) : false;

    if (!emailFilled) {
      throw stageError("form_detect", "missing_email_field", "Khong tim thay field email tren form dang ky.");
    }

    if (await hasCaptchaChallenge(page)) {
      throw stageError("form_detect", "captcha_detected", "Form dang ky co captcha/reCAPTCHA/hCaptcha can xu ly thu cong.");
    }

    const submit = submitControl(page);
    if ((await submit.count()) === 0) {
      throw stageError("form_detect", "missing_submit", "Khong tim thay nut submit tren form dang ky.");
    }
    await submit.click({ timeout: 5000 }).catch((error) => {
      throw stageError("form_submit", "click_failed", error instanceof Error ? error.message : String(error));
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    manualReviewUrl = page.url();

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
          persona: persona
            ? {
                id: persona.id,
                display_name: persona.display_name,
                username_base: persona.username_base,
                bio: persona.bio,
                gender: persona.gender,
                country: persona.country,
              }
            : null,
          proxy_id: proxy?.id ?? null,
          username_filled: usernameFilled,
          display_name_filled: displayNameFilled,
          bio_filled: bioFilled,
          password_fields: passwordCount,
          needs_verification: needsVerification,
          response_snippet: bodyText.slice(0, 500),
        },
      })
      .select("*")
      .single();
    if (error) throw stageError("account_save", "insert_failed", error.message);

    await releaseEmail(email.id);
    if (persona) await releaseLockedPersona(persona);
    if (proxy) await releaseProxy(proxy.id);
    return {
      account: account as RegistrationAccountRow,
      finalUrl: page.url(),
      message: needsVerification
        ? "Da submit form dang ky. Site co ve yeu cau xac minh email; tool se khong tu mo mail."
        : "Da submit form dang ky va luu account vao danh sach.",
    };
  } catch (error) {
    const manualReviewOpened = canOpenManualReview(error) && openManualReviewUrl(manualReviewUrl);
    await releaseEmail(email.id).catch(() => undefined);
    if (persona) await releaseLockedPersona(persona).catch(() => undefined);
    if (proxy) await releaseProxy(proxy.id).catch(() => undefined);
    if (manualReviewOpened && error instanceof Error) {
      throw stageError(
        "manual_review",
        "opened_browser",
        `${error.message} Da mo trang dang ky tren trinh duyet de ban xu ly thu cong.`,
      );
    }
    throw error;
  } finally {
    await browser.close();
  }
}
