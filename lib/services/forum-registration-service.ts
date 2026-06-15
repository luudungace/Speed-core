import path from "node:path";
import { exec } from "node:child_process";
import { chromium, type Locator, type Page } from "playwright";
import Tesseract from "tesseract.js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  readRegistrationQueue,
  writeRegistrationQueue,
  appendRegisteredAccounts,
  upsertRegistrationQueueItems,
} from "./registration-queue-store";
import { readEmailPool } from "./resource-store";
import { verifyRegisteredAccountEmail } from "./email-verification-service";

export type ForumRegistrationInput = {
  url: string;
  email: string;
};

export type ForumRegistrationResult = {
  url: string;
  email: string;
  username: string;
  password: string;
  status: "Đăng ký được" | "Không đăng ký được";
  note: string;
};

const AUTOMATION_PROFILE_DIR = path.join(process.cwd(), ".playwright-forum-profile");
const HUMAN_DELAY_MIN_MS = 350;
const HUMAN_DELAY_MAX_MS = 1200;
const DOMAIN_SELECTOR_CACHE = new Map<string, string[]>();

type RegistrationFieldValues = {
  email: string;
  username: string;
  password: string;
};

function makeUsername(email: string) {
  const local = email.split("@")[0] ?? "user";
  const cleaned = local.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "user";
  return `${cleaned}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20);
}

function makePassword() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `Secure@${randomNum}Abc!`;
}

function randomDelay(min = HUMAN_DELAY_MIN_MS, max = HUMAN_DELAY_MAX_MS) {
  return Math.floor(min + Math.random() * (max - min));
}

async function humanDelay(page: Page, min?: number, max?: number) {
  await safeWait(page, randomDelay(min, max));
}

async function safeWait(page: Page, ms: number) {
  if (page.isClosed()) return false;
  try {
    await page.waitForTimeout(ms);
    return !page.isClosed();
  } catch {
    return false;
  }
}

async function firstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) return locator;
  }
  return null;
}

async function fillFirst(page: Page, selectors: string[], value: string) {
  const locator = await firstVisible(page, selectors);
  if (!locator) return false;
  await locator.click({ force: true }).catch(() => undefined);
  await humanDelay(page, 150, 450);
  await locator.fill(value);
  await humanDelay(page);
  return true;
}

async function selectFirstAvailable(page: Page, selectors: string[], preferredText?: RegExp) {
  for (const selector of selectors) {
    const select = page.locator(selector).first();
    if ((await select.count()) === 0 || !(await select.isVisible().catch(() => false))) continue;

    const options = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value,
        text: (node.textContent ?? "").trim(),
      })),
    );
    const preferred = preferredText ? options.find((option) => preferredText.test(option.text)) : null;
    const fallback = options.find((option) => option.value && !/select|choose/i.test(option.text));
    const option = preferred ?? fallback;
    if (!option) continue;

    await humanDelay(page, 150, 450);
    await select.selectOption(option.value);
    await humanDelay(page, 150, 450);
    return true;
  }
  return false;
}

async function clickFirst(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      await humanDelay(page, 300, 900);
      await locator.click();
      return true;
    }
  }
  return false;
}

async function isTermsPage(page: Page) {
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /i agree to these terms|i do not agree to these terms|you agree not to post|by accessing .* you agree/i.test(text);
}

async function hasRegistrationForm(page: Page) {
  if ((await page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').count().catch(() => 0)) === 0) {
    return false;
  }
  if ((await page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]').count().catch(() => 0)) === 0) {
    return false;
  }
  return (await page.locator('button[type="submit"], input[type="submit"], form button').count().catch(() => 0)) > 0;
}

async function dismissUsercentrics(page: Page) {
  try {
    const clicked = await page.evaluate(() => {
      const root = document.getElementById("usercentrics-root");
      if (root && root.shadowRoot) {
        const acceptBtn = root.shadowRoot.querySelector('button[data-testid="uc-accept-all-button"]');
        if (acceptBtn) {
          (acceptBtn as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (err) {
    // Ignore
  }
  return false;
}

async function dismissCookieConsent(page: Page) {
  try {
    await dismissUsercentrics(page);
    const cookieButtons = await page.$$("a.cc-dismiss, button.cc-dismiss, .cc-btn, a[class*='cookie' i], button[class*='cookie' i], a:has-text('Got it!'), button:has-text('Got it!'), button:has-text('Accept'), a:has-text('Accept'), button:has-text('Đồng ý'), a:has-text('Đồng ý'), button:has-text('agree'), a:has-text('agree'), .js-accept-cookies, #accept-cookies, button[id*='cookie' i]");
    for (const btn of cookieButtons) {
      const isVisible = await btn.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
      }).catch(() => false);

      if (isVisible) {
        await btn.click().catch(() => undefined);
        await page.waitForTimeout(1000);
      }
    }
  } catch (err) {
    // Ignore
  }
}

// Security Question Solving functions
function solveSecurityQuestion(text: string): string | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized.includes("red") && normalized.includes("yellow") && (normalized.includes("mixed") || normalized.includes("color") || normalized.includes("paint"))) {
    return "orange";
  }
  if (normalized.includes("blue") && normalized.includes("yellow") && (normalized.includes("mixed") || normalized.includes("color") || normalized.includes("paint"))) {
    return "green";
  }
  if (normalized.includes("red") && normalized.includes("blue") && (normalized.includes("mixed") || normalized.includes("color") || normalized.includes("paint"))) {
    return "purple";
  }
  if (normalized.includes("color of the sky") || normalized.includes("colour of the sky") || normalized.includes("sky is what color")) {
    return "blue";
  }
  if (normalized.includes("color of grass") || normalized.includes("colour of grass") || normalized.includes("grass is what color")) {
    return "green";
  }
  if (normalized.includes("color of milk") || normalized.includes("colour of milk") || normalized.includes("milk is what color")) {
    return "white";
  }
  if (normalized.includes("color of coal") || normalized.includes("colour of coal") || normalized.includes("coal is what color")) {
    return "black";
  }

  // Math solving
  const mathMatch = normalized.match(/(\d+)\s*(plus|\+|\-|\*|times|minus)\s*(\d+)/i);
  if (mathMatch) {
    const a = Number(mathMatch[1]);
    const op = mathMatch[2].toLowerCase();
    const b = Number(mathMatch[3]);
    if (op === "plus" || op === "+") return String(a + b);
    if (op === "minus" || op === "-") return String(a - b);
    if (op === "times" || op === "*") return String(a * b);
  }

  const numberWordMatch = normalized.match(/(zero|one|two|three|four|five|six|seven|eight|nine|ten)\s*(plus|\+|\-|\*|times|minus)\s*(zero|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (numberWordMatch) {
    const wordMap: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    const a = wordMap[numberWordMatch[1].toLowerCase()];
    const op = numberWordMatch[2].toLowerCase();
    const b = wordMap[numberWordMatch[3].toLowerCase()];
    if (a !== undefined && b !== undefined) {
      if (op === "plus" || op === "+") return String(a + b);
      if (op === "minus" || op === "-") return String(a - b);
      if (op === "times" || op === "*") return String(a * b);
    }
  }

  return null;
}

// CAPTCHA Solver APIs
async function solveCaptchaViaApi(apiKey: string, type: string, sitekey: string, pageUrl: string): Promise<string> {
  try {
    let submitUrl = "https://api.2captcha.com/createTask";
    if (apiKey.startsWith("CAP-")) {
      submitUrl = "https://api.capsolver.com/createTask";
    }

    const payload = {
      clientKey: apiKey,
      task: {
        type: type === "recaptcha" ? "RecaptchaV2TaskProxyless" : type === "hcaptcha" ? "HCaptchaTaskProxyless" : "TurnstileTaskProxyless",
        websiteURL: pageUrl,
        websiteKey: sitekey,
      },
    };

    const res = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!data || data.errorId !== 0) {
      throw new Error(data?.errorDescription || "API error");
    }

    const taskId = data.taskId;
    let getResultUrl = apiKey.startsWith("CAP-") ? "https://api.capsolver.com/getTaskResult" : "https://api.2captcha.com/getTaskResult";

    const startTime = Date.now();
    while (Date.now() - startTime < 90000) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const pollRes = await fetch(getResultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      });
      const pollData = await pollRes.json();
      if (pollData.status === "ready") {
        return pollData.solution?.gRecaptchaResponse || pollData.solution?.token || "";
      }
      if (pollData.status === "failed") {
        throw new Error("Captcha task failed on solver side.");
      }
    }
    throw new Error("Timeout waiting for captcha solution");
  } catch (err) {
    console.error("Lỗi solveCaptchaViaApi:", err);
    return "";
  }
}

async function solveImageCaptchaViaGemini(geminiKey: string, base64Image: string): Promise<string> {
  try {
    const prompt = "Identify the characters (letters and numbers) in this captcha image. Return ONLY the plain text characters, with no spaces, punctuation, explanation, or markdown formatting.";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text.replace(/\s+/g, "").trim();
      }
    }
  } catch (err) {
    console.error("solveImageCaptchaViaGemini error:", err);
  }
  return "";
}

async function solveImageCaptchaViaTesseract(base64Image: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Image, "base64");
    const { data: { text } } = await Tesseract.recognize(buffer, "eng");
    if (text) {
      return text.replace(/[^a-zA-Z0-9]/g, "").trim();
    }
  } catch (err) {
    console.error("solveImageCaptchaViaTesseract error:", err);
  }
  return "";
}

async function solveImageCaptcha(apiKey: string, base64Image: string): Promise<string> {
  if (apiKey && apiKey.startsWith("AIzaSy")) {
    return await solveImageCaptchaViaGemini(apiKey, base64Image);
  }
  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes("YOUR_")) {
    return await solveImageCaptchaViaTesseract(base64Image);
  }
  return await solveImageCaptchaViaTesseract(base64Image);
}

async function solveSecurityQuestions(page: Page, geminiKey: string) {
  if (!geminiKey || geminiKey.trim().length === 0 || geminiKey.includes("YOUR_")) return;

  try {
    const inputs = await page.$$("input:not([type='hidden']):not([type='submit']):not([type='reset']):not([type='button']):not([type='checkbox']):not([type='radio'])");
    for (const input of inputs) {
      const isVisible = await input.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none" && window.getComputedStyle(el).visibility !== "hidden";
      }).catch(() => false);

      if (!isVisible) continue;

      const name = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();
      const id = (await input.getAttribute("id").catch(() => "") || "").toLowerCase();
      const placeholder = (await input.getAttribute("placeholder").catch(() => "") || "").toLowerCase();

      const skipKeywords = [
        "username", "email", "password", "pass", "login", "user", "mail", "confirm",
        "search", "location", "country", "city", "website", "homepage", "url", "bio", "about",
        "interest", "occupation", "signature", "avatar", "pf_"
      ];
      if (skipKeywords.some((kw) => name.includes(kw) || id.includes(kw) || placeholder.includes(kw))) {
        continue;
      }

      const existingVal = await input.evaluate((el) => (el as HTMLInputElement).value).catch(() => "") || "";
      if (existingVal.trim().length > 0) continue;

      const questionText = await page.evaluate((el) => {
        const clean = (s: string | null) => (s || "").replace(/\s+/g, " ").trim();
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label && label.textContent && label.textContent.trim().length > 3) return clean(label.textContent);
        }
        const closestLabel = el.closest("label");
        if (closestLabel && closestLabel.textContent && closestLabel.textContent.trim().length > 3) {
          return clean(closestLabel.textContent.replace(el.textContent || "", ""));
        }
        let parent = el.parentElement;
        for (let depth = 0; depth < 4; depth += 1) {
          if (!parent) break;
          const text = parent.textContent || "";
          const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
          for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (line.includes("?") || lowerLine.includes("security") || lowerLine.includes("spam") || lowerLine.includes("human") || lowerLine.includes("hỏi") || lowerLine.includes("câu hỏi") || lowerLine.includes("captcha") || lowerLine.includes("robot")) {
              if (line.length < 150) return clean(line);
            }
          }
          parent = parent.parentElement;
        }
        const prev = el.previousElementSibling;
        if (prev && prev.textContent && prev.textContent.trim().length > 3) {
          return clean(prev.textContent);
        }
        return "";
      }, input).catch(() => "");

      if (questionText && questionText.trim().length > 3) {
        const prompt = `Solve this security/anti-spam question found on a forum registration page. Return ONLY the answer itself (a single word, number, or short phrase as required), with no other text, explanation, punctuation, or markdown.
Question: "${questionText.trim()}"`;

        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (answer && answer.trim().length > 0) {
              const cleanAnswer = answer.trim().replace(/[".']/g, "");
              await input.fill(cleanAnswer).catch(() => undefined);
            }
          }
        } catch (e) {
          console.error("Gemini solving error:", e);
        }
      }
    }
  } catch (err) {
    console.error("solveSecurityQuestions error:", err);
  }
}

async function checkForSecurityScreen(page: Page) {
  try {
    const cfTitle = await page.title().catch(() => "");
    const hasCfTitle = cfTitle.includes("Just a moment") || cfTitle.includes("Attention Required");
    const hasCfChallengeDom = (await page.$("#cf-challenge-stage, iframe[src*='challenges.cloudflare.com'], .cf-turnstile")) !== null;
    const hasCloudflare = hasCfTitle || hasCfChallengeDom;

    const cfContent = await page.content().catch(() => "");
    const hasAnubis = cfTitle.includes("Making sure you're not a bot") || cfContent.includes("Anubis from Techaro") || cfContent.includes("Protected by Anubis");

    const isSelectorVisible = async (sel: string) => {
      try {
        const el = await page.$(sel);
        return el ? await el.isVisible() : false;
      } catch {
        return false;
      }
    };

    const hasHCaptcha = await isSelectorVisible("iframe[src*='hcaptcha']");
    const hasReCaptcha = await isSelectorVisible("iframe[src*='recaptcha'], .g-recaptcha");
    const hasTurnstile = await isSelectorVisible("iframe[src*='turnstile'], .cf-turnstile");
    const hasCaptchaField = await isSelectorVisible("input[name*='captcha' i], img[src*='captcha' i], img[src*='confirm' i], img[src*='code' i], input[name*='confirm' i], input[name*='code' i]");

    let hasCaptcha = false;
    let captchaType = "";
    let sitekey = "";

    if (hasHCaptcha) {
      hasCaptcha = true;
      captchaType = "hcaptcha";
      const hcaptchaEl = await page.$("[data-sitekey]");
      if (hcaptchaEl) sitekey = await hcaptchaEl.getAttribute("data-sitekey") ?? "";
    } else if (hasReCaptcha) {
      hasCaptcha = true;
      captchaType = "recaptcha";
      const recaptchaEl = await page.$("[data-sitekey]");
      if (recaptchaEl) sitekey = await recaptchaEl.getAttribute("data-sitekey") ?? "";
    } else if (hasTurnstile) {
      hasCaptcha = true;
      captchaType = "turnstile";
      const turnstileEl = await page.$(".cf-turnstile, [data-sitekey]");
      if (turnstileEl) sitekey = await turnstileEl.getAttribute("data-sitekey") ?? "";
    } else if (hasCaptchaField) {
      hasCaptcha = true;
      captchaType = "other";
    }

    if (hasCloudflare || hasCaptcha || hasAnubis) {
      if (hasAnubis) {
        let continueBtn = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 15000) {
          continueBtn = await page.$("a:has-text('Continue'), a:has-text('Продолжить'), button:has-text('Continue'), a[href*='redir']");
          if (continueBtn && await continueBtn.isVisible().catch(() => false)) break;
          await page.waitForTimeout(1000);
        }
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
          await page.waitForTimeout(3000);
          return;
        }
      }

      const apiKey = process.env.CAPTCHA_SOLVER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      let solved = false;

      if (apiKey && sitekey && ["recaptcha", "hcaptcha", "turnstile"].includes(captchaType)) {
        const token = await solveCaptchaViaApi(apiKey, captchaType, sitekey, page.url());
        if (token) {
          if (captchaType === "recaptcha") {
            await page.evaluate((t) => {
              const el = (document.getElementById("g-recaptcha-response") || document.querySelector("[name='g-recaptcha-response']")) as HTMLTextAreaElement | null;
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          } else if (captchaType === "hcaptcha") {
            await page.evaluate((t) => {
              const el = (document.querySelector("[name='h-captcha-response']") || document.querySelector("[name='g-recaptcha-response']")) as HTMLTextAreaElement | null;
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          } else if (captchaType === "turnstile") {
            await page.evaluate((t) => {
              const el = document.querySelector("[name='cf-turnstile-response']") as HTMLInputElement | null;
              if (el) { el.value = t; el.dispatchEvent(new Event("change")); }
            }, token);
          }
          await page.waitForTimeout(3000);
          solved = true;
        }
      } else if ((apiKey || geminiKey) && captchaType === "other") {
        const captchaImg = await page.$("img[src*='captcha' i], img[id*='captcha' i], img[src*='confirm' i], img[src*='code' i]");
        const captchaInput = await page.$("input[name*='captcha' i], input[id*='captcha' i], input[name*='confirm' i], input[name*='code' i]");

        if (captchaImg && captchaInput) {
          const buffer = await captchaImg.screenshot().catch(() => null);
          if (buffer) {
            const base64Image = buffer.toString("base64");
            const keyToUse = (apiKey && apiKey.trim().length > 0) ? apiKey : (geminiKey ?? "");
            const solution = await solveImageCaptcha(keyToUse, base64Image);
            if (solution) {
              await captchaInput.fill(solution);
              await page.waitForTimeout(2000);
              solved = true;
            }
          }
        }
      }

      if (solved) return;

      // System Sound Alert via PowerShell
      exec('powershell -Command "[System.Media.SystemSounds]::Hand.Play()"');
    }
  } catch (err) {
    console.error("checkForSecurityScreen error:", err);
  }
}

// Platform Specific Registration logic
async function registerXenForo(page: Page, url: string, values: RegistrationFieldValues) {
  await dismissCookieConsent(page);

  if (!page.url().includes("register") && !page.url().includes("signup")) {
    const regButton = await page.$("a[href*='register' i], a[href*='signup' i], a[href*='sign-up' i], a[href*='join' i], a[href*='create' i]");
    if (regButton) {
      await regButton.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await dismissCookieConsent(page);
    } else {
      const urlObj = new URL(url);
      const registerUrl = urlObj.origin + "/register/";
      await page.goto(registerUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
    }
  }

  await checkForSecurityScreen(page);
  await page.waitForSelector("input[type='text'], input[type='email'], input[autocomplete='username']", { timeout: 10000 }).catch(() => undefined);

  const inputs = await page.$$("input");
  let uEl = null;
  let eEl = null;
  let pEl = null;

  for (const input of inputs) {
    const isVisible = await input.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    }).catch(() => false);

    if (!isVisible) continue;

    const name = (await input.getAttribute("name") || "").toLowerCase();
    const autocomplete = (await input.getAttribute("autocomplete") || "").toLowerCase();
    const type = (await input.getAttribute("type") || "").toLowerCase();
    const id = (await input.getAttribute("id") || "").toLowerCase();

    const isHoneypot = await input.evaluate((el) => {
      const row = el.closest(".formRow") || el.closest("dl") || el.parentElement;
      if (row) {
        const rowText = (row as HTMLElement).innerText.toLowerCase();
        return rowText.includes("leave this field blank") || rowText.includes("không điền") || rowText.includes("honeypot");
      }
      return false;
    }).catch(() => false);

    if (isHoneypot) continue;

    if (!uEl && (autocomplete === "username" || autocomplete === "nickname" || name.includes("username") || id.includes("username"))) {
      uEl = input;
    } else if (!eEl && (autocomplete === "email" || type === "email" || name.includes("email") || id.includes("email"))) {
      eEl = input;
    } else if (!pEl && (autocomplete === "new-password" || autocomplete === "password" || type === "password" || name.includes("password") || id.includes("password"))) {
      pEl = input;
    }
  }

  if (uEl && eEl && pEl) {
    await uEl.fill(values.username);
    await eEl.fill(values.email);
    await pEl.fill(values.password);

    const agreeCheckbox = await page.$("input[type='checkbox'][name*='agree' i], input[type='checkbox'][name*='accept' i], input[type='checkbox'][required]");
    if (agreeCheckbox) {
      await agreeCheckbox.check().catch(() => undefined);
    }

    await solveSecurityQuestions(page, process.env.GEMINI_API_KEY || "");
    const submitBtn = await page.$("button[type='submit'], input[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);

      const errorEl = await page.$(".blockMessage--error, .errorList, .js-overlayContainer");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          throw new Error(`Đăng ký XenForo thất bại: ${errorText.trim()}`);
        }
      }
      return true;
    }
  }

  return false;
}

async function registerPhpBB(page: Page, url: string, values: RegistrationFieldValues) {
  const urlObj = new URL(url);
  let registerUrl = urlObj.origin + "/ucp.php?mode=register";

  await dismissCookieConsent(page);
  await page.goto(registerUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  await dismissCookieConsent(page);
  await checkForSecurityScreen(page);

  if (!page.url().includes("mode=register") && !page.url().includes("register")) {
    const regBtn = await page.$("a[href*='mode=register' i], a[href*='register' i], a:has-text('Register')");
    if (regBtn) {
      await regBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    }
  }

  // COPPA agreement bypass
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const isFormPresent = await page.evaluate(() => {
      const el = document.querySelector("input[name='email'], input[id='email']");
      return el ? !!((el as HTMLElement).offsetWidth || (el as HTMLElement).offsetHeight) : false;
    });

    if (isFormPresent) break;

    const nextBtn = await page.$("a[href*='coppa=0'], input[name='agreed'], button[name='agreed'], input[value*='agree' i], button:has-text('Agree')");
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    }
  }

  await page.waitForSelector("input[name='username'], input[id='username']", { timeout: 10000 }).catch(() => undefined);

  const usernameInput = await page.$("input[name='username'], input[id='username']");
  const emailInput = await page.$("input[name='email'], input[id='email']");
  const emailConfirmInput = await page.$("input[name='email_confirm']");
  const passwordInput = await page.$("input[name='new_password'], input[name='password']");
  const passwordConfirmInput = await page.$("input[name='password_confirm']");

  if (usernameInput && emailInput && passwordInput) {
    await usernameInput.fill(values.username);
    await emailInput.fill(values.email);
    if (emailConfirmInput) await emailConfirmInput.fill(values.email);
    await passwordInput.fill(values.password);
    if (passwordConfirmInput) await passwordConfirmInput.fill(values.password);

    await solveSecurityQuestions(page, process.env.GEMINI_API_KEY || "");
    const submitBtn = await page.$("input[type='submit'][name='submit'], button[type='submit'][name='submit'], button[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(3000);

      const errorEl = await page.$(".error, div.error, .errorlist");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          throw new Error(`Đăng ký phpBB thất bại: ${errorText.trim()}`);
        }
      }
      return true;
    }
  }
  return false;
}

async function registerWordPress(page: Page, url: string, values: RegistrationFieldValues) {
  const urlObj = new URL(url);
  const registerUrl = urlObj.origin + "/wp-login.php?action=register";
  await page.goto(registerUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await checkForSecurityScreen(page);

  await page.waitForSelector("input[id='user_login']", { timeout: 10000 }).catch(() => undefined);
  const uEl = await page.$("input[id='user_login']");
  const eEl = await page.$("input[id='user_email']");

  if (uEl && eEl) {
    await uEl.fill(values.username);
    await eEl.fill(values.email);

    const submitBtn = await page.$("input[id='wp-submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);

      const errorEl = await page.$("#login_error");
      if (errorEl) {
        const errorText = await errorEl.innerText().catch(() => "");
        if (errorText && errorText.trim().length > 0) {
          throw new Error(`Đăng ký WordPress thất bại: ${errorText.trim()}`);
        }
      }
      return true;
    }
  }
  return false;
}

async function runSemiAutoRegistration(page: Page, url: string, email: string, values: RegistrationFieldValues, originalError: string): Promise<boolean> {
  exec('powershell -Command "[System.Media.SystemSounds]::Hand.Play()"', (err) => {
    if (err) {
      exec('powershell -Command "[console]::beep(1000, 300)"');
    }
  });

  const semiAutoMsg = `[BÁN TỰ ĐỘNG] Lỗi: ${originalError.substring(0, 80)}. Vui lòng hoàn tất đăng ký thủ công trên trình duyệt đang mở.`;

  // Cập nhật lên hàng đợi Supabase
  await upsertRegistrationQueueItems([
    {
      url,
      title: null,
      rating: "",
      score: 0,
      siteType: "",
      email,
      username: values.username,
      password: values.password,
      status: "Bán tự động",
      note: semiAutoMsg,
    },
  ]);

  const maxWaitTimeMs = 300000; // 5 phút
  const pollIntervalMs = 4000;
  const startTime = Date.now();
  let registrationSuccess = false;

  while (Date.now() - startTime < maxWaitTimeMs) {
    if (page.isClosed()) break;

    // Check DB signal
    try {
      const queue = await readRegistrationQueue();
      const currentItem = queue.find((item) => item.url === url);
      if (currentItem && currentItem.status === "Xác nhận thủ công") {
        registrationSuccess = true;
        break;
      }
    } catch {}

    // Check URL / Page content changes
    try {
      const currentUrl = page.url();
      const pageContent = await page.content().catch(() => "");
      const currentTitle = await page.title().catch(() => "");

      const isOnRegisterPage = currentUrl.includes("register") || currentUrl.includes("signup") || currentUrl.includes("mode=register");
      const hasSuccessText = pageContent.includes("registered successfully") ||
                             pageContent.includes("đăng ký thành công") ||
                             pageContent.includes("activation") ||
                             pageContent.includes("kích hoạt tài khoản") ||
                             pageContent.includes("will receive an email") ||
                             currentTitle.includes("Success");

      if (!isOnRegisterPage || hasSuccessText) {
        registrationSuccess = true;
        break;
      }
    } catch {}

    await page.waitForTimeout(pollIntervalMs);
  }

  return registrationSuccess;
}

// Fallback / Heuristics form filler
async function registerFallback(page: Page, url: string, values: RegistrationFieldValues) {
  const currentUrl = page.url().toLowerCase();
  const isOnRegisterPage = currentUrl.includes("register") || currentUrl.includes("signup") || currentUrl.includes("sign-up") || currentUrl.includes("createaccount") || currentUrl.includes("mode=register");

  if (!isOnRegisterPage) {
    const regBtn = await page.$("a[href*='register' i], a[href*='signup' i], a[href*='sign-up' i], a[href*='create-account' i], a:has-text('Register'), a:has-text('Sign Up')");
    if (regBtn) {
      await regBtn.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await dismissCookieConsent(page);
      await checkForSecurityScreen(page);
    }
  }

  const agreeBtn = await page.$("input[type='submit'][name='agreed'], button:has-text('Agree'), button:has-text('Accept'), button:has-text('Đồng ý')");
  if (agreeBtn && await agreeBtn.isVisible().catch(() => false)) {
    await agreeBtn.click();
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await dismissCookieConsent(page);
    await checkForSecurityScreen(page);
  }

  await page.waitForSelector("input", { timeout: 8000 }).catch(() => undefined);
  const usernameField = await firstVisible(page, ['input[name="username"]', "#username", 'input[autocomplete="username"]', 'input[id*="username" i]']);
  const emailField = await firstVisible(page, ['input[type="email"]', 'input[name="email"]', "#email", 'input[autocomplete="email"]']);

  if (usernameField && emailField) {
    await usernameField.fill(values.username);
    await emailField.fill(values.email);

    const passwordFields = await page.locator('input[type="password"], input[name*="pass" i]').all();
    for (const passField of passwordFields) {
      await passField.fill(values.password);
    }

    await solveSecurityQuestions(page, process.env.GEMINI_API_KEY || "");
    const submitBtn = await page.$("button[type='submit'], input[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
      return true;
    }
  }

  return false;
}

async function detectCMS(page: Page): Promise<"XenForo" | "phpBB" | "WordPress" | "Generic"> {
  const pageContent = await page.content().catch(() => "");
  const pageUrl = page.url().toLowerCase();

  let assetsPattern = `(?:\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
  try {
    const parsed = new URL(page.url());
    const host = parsed.hostname.replace(/^www\./, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assetsPattern = `(?:(?:https?:)?\\/\\/(?:[^/]+\\.)?${host}|\\/|\\.\\/|\\.\\.\\/|wp-content|wp-includes|styles|js|clientscript|ucp\\.php)`;
  } catch {}

  const hasWP = pageUrl.includes("wp-login") || pageUrl.includes("wp-signup") || new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(wp-content|wp-includes)\\/`, "i").test(pageContent);
  const hasPhpBB = pageUrl.includes("ucp.php") || /powered\s+by\s+phpBB/i.test(pageContent) || new RegExp(`(?:href|action)=["']${assetsPattern}[^"']*(viewforum\\.php\\?f=|viewtopic\\.php\\?[ft]=|ucp\\.php\\?mode=)`, "i").test(pageContent) || pageContent.includes("styles/prosilver");
  const hasXF = pageUrl.includes("xf-") || pageContent.includes("js-xenforo") || /XF\.config\s*=/i.test(pageContent) || new RegExp(`(?:href|src)=["']${assetsPattern}[^"']*(styles\\/default\\/xenforo|js\\/xf)\\/`, "i").test(pageContent);

  if (hasWP) return "WordPress";
  if (hasPhpBB) return "phpBB";
  if (hasXF) return "XenForo";
  return "Generic";
}

export async function registerForumAccount(input: ForumRegistrationInput): Promise<ForumRegistrationResult> {
  const username = makeUsername(input.email);
  const password = makePassword();
  const fieldValues = { email: input.email, username, password };

  const context = await chromium.launchPersistentContext(AUTOMATION_PROFILE_DIR, {
    headless: false,
    channel: "chromium",
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-blink-features=AutomationControlled"],
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Ho_Chi_Minh",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(2000);

    await checkForSecurityScreen(page);
    await dismissCookieConsent(page);

    const cms = await detectCMS(page);
    let success = false;

    try {
      if (cms === "XenForo") {
        success = await registerXenForo(page, input.url, fieldValues);
      } else if (cms === "phpBB") {
        success = await registerPhpBB(page, input.url, fieldValues);
      } else if (cms === "WordPress") {
        success = await registerWordPress(page, input.url, fieldValues);
      } else {
        success = await registerFallback(page, input.url, fieldValues);
      }

      if (!success) throw new Error("Điền form tự động không thành công.");
    } catch (regErr: any) {
      // Fallback to semi-auto interactive mode
      success = await runSemiAutoRegistration(page, input.url, input.email, fieldValues, regErr.message);
      if (!success) {
        return {
          url: input.url,
          email: input.email,
          username,
          password,
          status: "Không đăng ký được",
          note: regErr.message || "Đăng ký bán tự động thất bại hoặc hết thời gian.",
        };
      }
    }

    return {
      url: input.url,
      email: input.email,
      username,
      password,
      status: "Đăng ký được",
      note: "Đăng ký thành công, tài khoản đã được ghi nhận.",
    };
  } catch (error: any) {
    return {
      url: input.url,
      email: input.email,
      username,
      password,
      status: "Không đăng ký được",
      note: error.message || "Lỗi không xác định trong quá trình đăng ký.",
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
