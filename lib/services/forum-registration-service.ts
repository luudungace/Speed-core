import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

export type ForumRegistrationInput = {
  url: string;
  email: string;
};

export type ForumRegistrationResult = {
  url: string;
  email: string;
  username: string;
  password: string;
  status: "ÄÄƒng kÃ½ Ä‘Æ°á»£c" | "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c";
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
  return `Aic!${Math.random().toString(36).slice(2, 10)}${Math.floor(1000 + Math.random() * 9000)}`;
}

function randomDelay(min = HUMAN_DELAY_MIN_MS, max = HUMAN_DELAY_MAX_MS) {
  return Math.floor(min + Math.random() * (max - min));
}

async function humanDelay(page: Page, min?: number, max?: number) {
  await safeWait(page, randomDelay(min, max));
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

async function safeWait(page: Page, ms: number) {
  if (page.isClosed()) return false;
  try {
    await page.waitForTimeout(ms);
    return !page.isClosed();
  } catch {
    return false;
  }
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

function scoreRegistrationUrl(url: string, text: string) {
  const haystack = `${url}\n${text}`.toLowerCase();
  let score = 0;
  if (/register|signup|sign-up|join|create-account|create_account/.test(haystack)) score += 40;
  if (/login|signin|sign-in/.test(haystack)) score -= 15;
  if (/privacy|terms|faq|search|memberlist|forgot|reset|logout/.test(haystack)) score -= 30;
  return score;
}

async function discoverRegistrationUrl(page: Page, originalUrl: string) {
  if ((await isTermsPage(page)) || (await hasRegistrationForm(page))) return true;

  const baseUrl = new URL(page.url() || originalUrl);
  const candidates = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors
        .map((anchor) => {
          const element = anchor as HTMLAnchorElement;
          return {
            href: element.href,
            text: (element.textContent ?? "").trim(),
          };
        })
        .filter((item) => item.href),
    )
    .catch(() => []);

  const cmsCandidates = [
    new URL("/register/", baseUrl).toString(),
    new URL("/signup/", baseUrl).toString(),
    new URL("/forum/ucp.php?mode=register", baseUrl).toString(),
    new URL("/ucp.php?mode=register", baseUrl).toString(),
    new URL("/wp-login.php?action=register", baseUrl).toString(),
  ].map((href) => ({ href, text: "register" }));

  const ranked = [...candidates, ...cmsCandidates]
    .map((candidate) => ({
      ...candidate,
      score: scoreRegistrationUrl(candidate.href, candidate.text),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const candidate of ranked) {
    await page.goto(candidate.href, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
    await safeWait(page, 1000);
    if ((await isTermsPage(page)) || (await hasRegistrationForm(page))) return true;
  }

  return false;
}

async function acceptRegistrationTerms(page: Page) {
  if (!(await isTermsPage(page))) return false;

  const agreedInput = page.locator('input[type="submit"][name="agreed"]').first();
  if ((await agreedInput.count()) > 0) {
    await agreedInput.click({ force: true }).catch(() => undefined);
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => undefined);
    await safeWait(page, 1000);
    if (!(await isTermsPage(page))) return true;

    await agreedInput
      .evaluate((element) => {
        const input = element as HTMLInputElement;
        const form = input.form;
        if (!form) return;
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = input.name;
        hidden.value = input.value || "I agree to these terms";
        form.appendChild(hidden);
        form.submit();
      })
      .catch(() => undefined);
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => undefined);
    await safeWait(page, 1000);
    if (!(await isTermsPage(page))) return true;
  }

  const agreeSelectors = [
    'input[type="submit"][name="agreed"]',
    'input[name="agreed"]',
    'button[type="submit"][name="agreed"]',
    'button[name="agreed"]',
    'input[value="I agree to these terms"]',
    'input[type="submit"][value*="I agree" i]',
    'input[type="submit"][value*="agree" i]',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'a:has-text("I agree")',
    'a:has-text("Agree")',
  ];

  const clicked = await clickFirst(page, agreeSelectors);
  if (!clicked) {
    const exactAgree = page.getByText("I agree to these terms", { exact: true }).first();
    if ((await exactAgree.count()) > 0 && (await exactAgree.isVisible().catch(() => false))) {
      await exactAgree.click({ force: true }).catch(() => undefined);
    }
  }
  if (!clicked) {
    for (const selector of agreeSelectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await locator.evaluate((element) => (element as HTMLElement).click()).catch(() => undefined);
        break;
      }
    }
  }
  if (await isTermsPage(page)) {
    await page
      .locator('form input[name="agreed"], form button[name="agreed"], form input[value="I agree to these terms"]')
      .first()
      .evaluate((element) => {
        const form = (element as HTMLInputElement).form;
        if (form) form.requestSubmit(element as HTMLElement);
      })
      .catch(() => undefined);
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
  await safeWait(page, 800);
  return !(await isTermsPage(page));
}

async function hasCaptcha(page: Page) {
  const html = await page.content().catch(() => "");
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /captcha|recaptcha|hcaptcha|cf-turnstile|security question|verification question|confirmation code|automated sign-ups|verification code/i.test(
    `${html}\n${text}`,
  );
}

async function detectAccessChallenge(page: Page) {
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const visible = `${title}\n${text}`;
  const hasVisibleChallenge =
    /just a moment|checking your browser|performing security verification|attention required|access denied|ddos-guard/i.test(
      visible,
    );
  const hasCloudflareChallengeMarkup =
    /cf-challenge|cf-turnstile|challenge-platform|cdn-cgi\/challenge-platform|cf-browser-verification|g-recaptcha|h-captcha/i.test(
      html,
    );
  return hasVisibleChallenge || hasCloudflareChallengeMarkup;
}

async function waitForChallengeToClear(page: Page) {
  if (await isTermsPage(page)) return true;
  if ((await page.locator('input[name="username"], #username, input[type="password"]').count().catch(() => 0)) > 0) {
    return true;
  }
  if (!(await detectAccessChallenge(page))) return true;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (page.isClosed()) return false;
    if (!(await safeWait(page, 5000))) return false;
    if (await isTermsPage(page)) return true;
    if ((await page.locator('input[name="username"], #username, input[type="password"]').count().catch(() => 0)) > 0) {
      return true;
    }
    if (!(await detectAccessChallenge(page))) return true;
  }
  return false;
}

function isSuccessfulSubmission(text: string) {
  return /created|registered|registration complete|thank you for registering|account has been created|activate|activation|verify|verification|email has been sent|check your email|Ä‘Äƒng kÃ½ thÃ nh cÃ´ng|xÃ¡c minh|kÃ­ch hoáº¡t/i.test(text);
}

function extractRegistrationError(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errorLine = lines.find((line) =>
    /incorrect|invalid|already|taken|too short|too long|password|username|email|confirmation code|code you entered|does not match|error/i.test(line),
  );
  return errorLine ? errorLine.slice(0, 220) : null;
}

function getForumLoginUrl(currentUrl: string, fallbackUrl: string) {
  const source = currentUrl || fallbackUrl;
  try {
    const url = new URL(source);
    if (/ucp\.php/i.test(url.pathname)) {
      url.search = "?mode=login";
      return url.toString();
    }
    if (/\/forum\/?$/i.test(url.pathname)) return new URL("ucp.php?mode=login", url).toString();
    return new URL("/forum/ucp.php?mode=login", url).toString();
  } catch {
    return fallbackUrl;
  }
}

async function verifyLoginWorks(page: Page, originalUrl: string, username: string, password: string) {
  const loginUrl = getForumLoginUrl(page.url(), originalUrl);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
  await safeWait(page, 1000);

  const usernameField = await firstVisible(page, [
    'input[name="username"]',
    "#username",
    'input[autocomplete="username"]',
    'input[id*="username" i]',
    'input[name*="user" i]',
  ]);
  const passwordField = await firstVisible(page, [
    'input[type="password"]',
    'input[name="password"]',
    "#password",
    'input[id*="password" i]',
    'input[name*="pass" i]',
  ]);
  if (!usernameField || !passwordField) {
    return { ok: false, note: "Đã submit form nhưng không tìm thấy form đăng nhập để kiểm tra tài khoản." };
  }

  await usernameField.fill(username);
  await humanDelay(page, 150, 450);
  await passwordField.fill(password);
  await humanDelay(page, 150, 450);

  await submitRegistrationForm(page, usernameField);
  await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
  await safeWait(page, 1500);

  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  if (/logout|log out|ucp\.php\?mode=logout|user control panel|private messages|view your posts/i.test(text)) {
    return { ok: true, note: "Đăng ký thành công và đăng nhập kiểm tra được." };
  }
  const error = extractRegistrationError(text);
  if (/inactive|activate|activation|admin|approve|not active|not activated|confirm|verify|email/i.test(text)) {
    return { ok: false, note: "Đã submit form nhưng tài khoản chưa đăng nhập được, có thể đang chờ email/admin xác nhận." };
  }
  return { ok: false, note: error ?? "Đã submit form nhưng đăng nhập kiểm tra không thành công." };
}

async function waitForManualCaptcha(page: Page) {
  const selectors = [
    'input[name="qa_answer"]',
    "#answer",
    'input[name*="answer" i]',
    'input[id*="answer" i]',
    'input[name*="qa" i]',
    'input[id*="qa" i]',
    'input[name="confirm_code"]',
    'input[name="confirmation_code"]',
    'input[name="captcha"]',
    'input[id*="confirm" i]',
    'input[id*="captcha" i]',
  ];

  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (page.isClosed()) return false;
    if (await answerKnownSecurityQuestion(page)) return true;
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0 || !(await locator.isVisible().catch(() => false))) continue;
      const value = await locator.inputValue().catch(() => "");
      if (value.trim()) return true;
    }
    if (!(await safeWait(page, 5000))) return false;
  }

  return false;
}

async function submitRegistrationForm(page: Page, formField: Locator | null) {
  const selectors = [
    'input[name="submit"]',
    'button[name="submit"]',
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Register")',
    'button:has-text("Submit")',
  ];

  if (formField) {
    const submitted = await formField
      .evaluate((element) => {
        const input = element as HTMLInputElement;
        const form = input.form;
        if (!form) return false;
        const submitter = form.querySelector(
          'input[name="submit"], button[name="submit"], button[type="submit"], input[type="submit"], button',
        ) as HTMLElement | null;
        if (submitter) {
          submitter.click();
        } else {
          form.requestSubmit();
        }
        return true;
      })
      .catch(() => false);
    if (submitted) return true;
  }

  return clickFirst(page, selectors);
}

function numberFromWord(value: string) {
  const words: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  return /^\d+$/.test(value) ? Number(value) : words[value.toLowerCase()];
}

function solveSecurityQuestion(question: string) {
  const normalized = question
    .toLowerCase()
    .replace(/[^\w+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  if (/colou?r|paint|mixed|mix/i.test(normalized)) {
    const hasRed = /\b(?:red|read)\b/.test(normalized);
    const hasYellow = /\byell?ow\b/.test(normalized);
    const hasBlue = /\bblue\b/.test(normalized);
    const hasBlack = /\bblack\b/.test(normalized);
    const hasWhite = /\bwhite\b/.test(normalized);
    if (hasRed && hasYellow) return "orange";
    if (hasBlue && hasYellow) return "green";
    if (hasRed && hasBlue) return "purple";
    if (hasBlack && hasWhite) return "gray";
  }

  const asksIpswichManager =
    /manager.*1961\s*62.*league.*winning|1961\s*62.*league.*winning.*manager|who.*manager.*1961\s*62|manager.*our.*1961\s*62/i.test(
      normalized,
    );
  if (asksIpswichManager) {
    const hasIpswichContext = /tractor[\s-]?boys|ipswich|itfc|portman road/i.test(normalized);
    return hasIpswichContext ? "Alf Ramsey" : null;
  }

  const looksLikeMathQuestion = /what is|calculate|answer|equals?|sum|plus|add|minus|subtract|\d+\s*[+-]\s*\d+/i.test(normalized);
  if (!looksLikeMathQuestion) return null;

  const math = normalized.match(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:\+|plus|add|added to)\s*\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (math) {
    const left = numberFromWord(math[1]);
    const right = numberFromWord(math[2]);
    if (typeof left === "number" && typeof right === "number") return String(left + right);
  }

  const subtract = normalized.match(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:-|minus|subtract)\s*\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (subtract) {
    const left = numberFromWord(subtract[1]);
    const right = numberFromWord(subtract[2]);
    if (typeof left === "number" && typeof right === "number") return String(left - right);
  }

  if (/what colou?r.*grass|grass.*what colou?r/i.test(normalized)) return "green";
  if (/what colou?r.*sky|sky.*what colou?r/i.test(normalized)) return "blue";
  if (/name of this site|site name|forum name/i.test(normalized)) return null;

  return null;
}

async function answerKnownSecurityQuestion(page: Page) {
  const textForKnownSelector = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const knownSelectorAnswer = solveSecurityQuestion(textForKnownSelector);
  if (knownSelectorAnswer) {
    const knownSelector = page.locator('input[name="qa_answer"], #answer, input[name*="answer" i], input[id*="answer" i]').first();
    if ((await knownSelector.count()) > 0 && (await knownSelector.isVisible().catch(() => false))) {
      if (await fieldIsEmpty(knownSelector)) {
        await knownSelector.click({ force: true }).catch(() => undefined);
        await humanDelay(page, 150, 450);
        await knownSelector.fill(knownSelectorAnswer);
        await humanDelay(page);
      }
      return true;
    }
  }

  const directlyFilled = await page
    .evaluate(() => {
      const questions = [
        {
          match: (text: string) =>
            text.includes("who was our manager") &&
            text.includes("1961/62") &&
            text.includes("league winning") &&
            /tractor[\s-]?boys|ipswich|itfc|portman road/i.test(text),
          answer: "Alf Ramsey",
        },
        {
          match: (text: string) =>
            (text.includes("read and yellow paint") || text.includes("red and yellow paint")) &&
            (text.includes("what colour") || text.includes("what color")),
          answer: "orange",
        },
      ];
      const isVisible = (field: HTMLElement) => {
        const style = window.getComputedStyle(field);
        return style.display !== "none" && style.visibility !== "hidden" && field.offsetWidth > 0 && field.offsetHeight > 0;
      };
      const canUseField = (field: Element) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
        const type = (field.getAttribute("type") || "text").toLowerCase();
        const nameId = `${field.getAttribute("name") || ""} ${field.id || ""}`;
        if (/hidden|submit|button|reset|password|email|file|checkbox|radio/i.test(type)) return false;
        if (/user|email|mail|pass|postcode|postal|zip|city|country|location|website/i.test(nameId)) return false;
        return !field.disabled && isVisible(field) && !field.value.trim();
      };
      const fill = (field: HTMLInputElement | HTMLTextAreaElement, answer: string) => {
        field.focus();
        field.value = answer;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        field.blur();
        return true;
      };
      const containers = [...document.querySelectorAll("dl, tr, fieldset, section, .panel, .content, div")].sort(
        (a, b) => (a.textContent?.length || 0) - (b.textContent?.length || 0),
      );
      for (const container of containers) {
        const text = (container.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        const question = questions.find((item) => item.match(text));
        if (!question) continue;
        const field = [...container.querySelectorAll("input, textarea")].find(canUseField) as HTMLInputElement | HTMLTextAreaElement | undefined;
        if (field) return fill(field, question.answer);
      }
      return false;
    })
    .catch(() => false);
  if (directlyFilled) {
    await humanDelay(page);
    return true;
  }

  const knownQuestionFollowers = [
    {
      question: /who was our manager for our 1961\/62 league winning season/i,
      answer: "Alf Ramsey",
      xpath:
        '//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "who was our manager for our 1961/62 league winning season")]/following::input[not(@type="hidden") and not(@type="submit") and not(@type="button") and not(@type="reset")][1]',
    },
    {
      question: /read and yellow paint mixed together produces what colou?r/i,
      answer: "orange",
      xpath:
        '//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "read and yellow paint mixed together produces what colour") or contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "red and yellow paint mixed together produces what color")]/following::input[not(@type="hidden") and not(@type="submit") and not(@type="button") and not(@type="reset")][1]',
    },
  ];
  const bodyText = textForKnownSelector;
  for (const item of knownQuestionFollowers) {
    if (!item.question.test(bodyText)) continue;
    if (item.answer === "Alf Ramsey" && !/tractor[\s-]?boys|ipswich|itfc|portman road/i.test(bodyText)) continue;
    const locator = page.locator(`xpath=${item.xpath}`).first();
    if ((await locator.count()) === 0 || !(await locator.isVisible().catch(() => false))) continue;
    if (!(await fieldIsEmpty(locator))) return true;
    await locator.click({ force: true }).catch(() => undefined);
    await humanDelay(page, 150, 450);
    await locator.fill(item.answer);
    await humanDelay(page);
    return true;
  }

  const filledByDocumentOrder = await page
    .locator('input[type="text"], input:not([type]), textarea')
    .evaluateAll((elements) => {
      const visibleText = (node: Element | null) => (node?.textContent || "").replace(/\s+/g, " ").trim();
      const visible = (field: HTMLInputElement | HTMLTextAreaElement) => {
        const style = window.getComputedStyle(field);
        return !field.disabled && style.display !== "none" && style.visibility !== "hidden" && field.offsetWidth > 0 && field.offsetHeight > 0;
      };
      const textBefore = (field: HTMLInputElement | HTMLTextAreaElement) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        const parts: string[] = [];
        let node = walker.nextNode();
        while (node) {
          if (node === field) break;
          if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || "").replace(/\s+/g, " ").trim();
            if (text) parts.push(text);
          }
          node = walker.nextNode();
        }
        return parts.join(" ").slice(-1200);
      };
      return elements
        .map((element, index) => {
          const field = element as HTMLInputElement | HTMLTextAreaElement;
          const name = field.getAttribute("name") || "";
          const id = field.id || "";
          const context = [
            field.closest("fieldset, .panel, dl, tr, div, table") ? visibleText(field.closest("fieldset, .panel, dl, tr, div, table")) : "",
            field.parentElement?.previousElementSibling ? visibleText(field.parentElement.previousElementSibling) : "",
            textBefore(field),
          ]
            .filter(Boolean)
            .join(" ");
          return { index, visible: visible(field), name, id, context };
        })
        .filter((item) => item.visible && !/user|email|mail|pass|postcode|postal|zip|city|country|location|website/i.test(`${item.name} ${item.id}`));
    })
    .catch(() => []);

  for (const field of filledByDocumentOrder) {
    const answer = solveSecurityQuestion(field.context);
    if (!answer) continue;
    await page.locator('input[type="text"], input:not([type]), textarea').nth(field.index).fill(answer);
    await humanDelay(page);
    return true;
  }

  const fieldAnswers = await page
    .locator('input[type="text"], input:not([type]), textarea')
    .evaluateAll((elements) =>
      elements
        .map((element, index) => {
          const field = element as HTMLInputElement | HTMLTextAreaElement;
          const style = window.getComputedStyle(field);
          const nearbyTexts: string[] = [];
          const addText = (value?: string | null) => {
            const text = (value || "").replace(/\s+/g, " ").trim();
            if (text && text.length < 700) nearbyTexts.push(text);
          };
          let current: HTMLElement | null = field;
          for (let level = 0; current && level < 7; level += 1) {
            addText(current.textContent);
            addText(current.previousElementSibling?.textContent);
            addText(current.parentElement?.previousElementSibling?.textContent);
            current = current.parentElement;
          }
          const closestText = (field.closest("fieldset, .panel, dl, tr, div, table")?.textContent || "").replace(/\s+/g, " ").trim();
          const labelText = [
            field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent || "" : "",
            field.closest("label")?.textContent || "",
            closestText.length < 700 ? closestText : "",
            field.getAttribute("aria-label") || "",
            field.getAttribute("placeholder") || "",
            field.getAttribute("name") || "",
            ...nearbyTexts,
          ]
            .filter(Boolean)
            .join(" ");
          return {
            index,
            visible: !field.disabled && style.display !== "none" && style.visibility !== "hidden" && field.offsetWidth > 0 && field.offsetHeight > 0,
            name: field.getAttribute("name") || "",
            id: field.id || "",
            type: (field.getAttribute("type") || "").toLowerCase(),
            labelText,
          };
        })
        .filter((item) => item.visible),
    )
    .catch(() => []);

  for (const field of fieldAnswers) {
    if (/user|email|mail|pass|postcode|postal|zip|city|country|location|website/i.test(`${field.name} ${field.id}`)) continue;
    const answer = solveSecurityQuestion(field.labelText);
    if (!answer) continue;
    await page.locator('input[type="text"], input:not([type]), textarea').nth(field.index).fill(answer);
    await humanDelay(page);
    return true;
  }

  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const answer = solveSecurityQuestion(text);
  if (!answer) return false;

  if (
    await fillFirst(
      page,
      ['input[name="qa_answer"]', "#answer", 'input[name*="answer" i]', 'input[id*="answer" i]'],
      answer,
    )
  ) {
    return true;
  }

  const questionField = page
    .locator('fieldset, .panel, dl, tr, div')
    .filter({ hasText: /colou?r|paint|mixed|plus|\+|minus|grass|sky|manager|season|league/i })
    .locator('input[type="text"], input:not([type]), textarea')
    .first();
  if ((await questionField.count()) > 0 && (await questionField.isVisible().catch(() => false))) {
    await questionField.fill(answer);
    await humanDelay(page);
    return true;
  }

  return fillFirst(
    page,
    ['input[name*="qa" i]', 'input[id*="qa" i]', 'input[name*="question" i]', 'input[id*="question" i]'],
    answer,
  );
}

async function ensureKnownSecurityQuestionAnswered(page: Page) {
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const hasKnownQuestion = Boolean(solveSecurityQuestion(bodyText));
  const fieldSelector = [
    'input[name="qa_answer"]',
    "#answer",
    'input[name*="answer" i]',
    'input[id*="answer" i]',
    'input[name*="qa" i]',
    'input[id*="qa" i]',
    'input[name*="question" i]',
    'input[id*="question" i]',
    'input[type="text"]',
    "input:not([type])",
    "textarea",
  ].join(", ");
  const fields = await page
    .locator(fieldSelector)
    .evaluateAll((elements) =>
      elements.map((element, index) => {
        const field = element as HTMLInputElement | HTMLTextAreaElement;
        const style = window.getComputedStyle(field);
        const type = (field.getAttribute("type") || "text").toLowerCase();
        const container = field.closest("dl, tr, fieldset, .panel, .inner, div, table");
        const labels = [
          field.getAttribute("aria-label") || "",
          field.getAttribute("placeholder") || "",
          field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent || "" : "",
          container?.textContent || "",
          container?.previousElementSibling?.textContent || "",
        ];
        const context = labels.join(" ").replace(/\s+/g, " ").trim();
        return {
          index,
          name: field.getAttribute("name") || "",
          id: field.id || "",
          type,
          value: field.value || "",
          visible: !field.disabled && style.display !== "none" && style.visibility !== "hidden" && field.offsetWidth > 0 && field.offsetHeight > 0,
          context: context.slice(0, 700),
        };
      }),
    )
    .catch(() => []);

  const candidates = fields.filter(
    (field) =>
      field.visible &&
      field.value.trim() === "" &&
      !/hidden|submit|button|reset|password|email|file|checkbox|radio/i.test(field.type) &&
      !/user|email|mail|pass|postcode|postal|zip|city|country|location|website|homepage|url|occupation|interests|signature/i.test(
        `${field.name} ${field.id}`,
      ) &&
      /colou?r|paint|mixed|plus|\+|minus|grass|sky|manager|season|league|confirmation|registration|spam|spambot|question|captcha/i.test(
        field.context,
      ),
  );

  if (candidates.length === 0) {
    return {
      ok: !hasKnownQuestion,
      present: hasKnownQuestion,
      note: hasKnownQuestion ? "Có câu hỏi bảo mật trong trang nhưng không tìm thấy ô text khả dụng để điền đáp án." : "",
    };
  }

  for (const candidate of candidates) {
    const answer = solveSecurityQuestion(`${candidate.context}\n${bodyText}`) ?? solveSecurityQuestion(bodyText);
    if (!answer) continue;
    const locator = page.locator(fieldSelector).nth(candidate.index);
    if (await fieldIsEmpty(locator)) {
      await locator.click({ force: true }).catch(() => undefined);
      await humanDelay(page, 150, 450);
      await locator.fill(answer);
      await locator.evaluate((element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await humanDelay(page);
    }
    const value = await locator.inputValue().catch(() => "");
    if (value.trim()) {
      return { ok: true, present: true, note: `Đã điền câu hỏi bảo mật ${candidate.name || candidate.id || "text input"}: ${value.trim()}.` };
    }
    return {
      ok: false,
      present: true,
      note: `Đã thử điền câu hỏi bảo mật ${candidate.name || candidate.id || "text input"} nhưng value vẫn rỗng. Context: ${candidate.context}`,
    };
  }

  return {
    ok: !hasKnownQuestion,
    present: hasKnownQuestion,
    note: hasKnownQuestion ? `Không map được đáp án cho câu hỏi bảo mật. Fields: ${candidates.map((field) => `${field.name || field.id || "text"}:${field.context}`).join(" | ").slice(0, 500)}` : "",
  };
}

async function waitForManualSecurityQuestion(page: Page, reason: string, timeoutMs = 5 * 60 * 1000) {
  const startedAt = Date.now();
  const selectors = [
    'input[name="qa_answer"]',
    "#answer",
    'input[name*="answer" i]',
    'input[id*="answer" i]',
    'input[name*="qa" i]',
    'input[id*="qa" i]',
    'input[name*="question" i]',
    'input[id*="question" i]',
    'input[id*="confirm" i]',
    'input[name*="confirm" i]',
    'input[id*="captcha" i]',
    'input[name*="captcha" i]',
  ];

  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) {
      return { ok: false, note: "Cửa sổ Chromium đã bị đóng trước khi bạn xử lý câu hỏi bảo mật." };
    }

    const autoState = await ensureKnownSecurityQuestionAnswered(page);
    if (autoState.ok) return { ok: true, note: autoState.note || "Đã xử lý câu hỏi bảo mật." };

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0 || !(await locator.isVisible().catch(() => false))) continue;
      const value = await locator.inputValue().catch(() => "");
      if (value.trim()) return { ok: true, note: "Bạn đã điền câu hỏi bảo mật, automation tiếp tục submit." };
    }

    await safeWait(page, 3000);
  }

  return {
    ok: false,
    note: `${reason} Automation đã giữ browser mở 5 phút nhưng chưa thấy bạn điền câu hỏi bảo mật.`,
  };
}

async function fillProfileFields(page: Page) {
  await fillFirst(page, ['input[name*="postcode" i]', 'input[id*="postcode" i]', 'input[name*="postal" i]', 'input[id*="postal" i]'], "100000");
  await selectFirstAvailable(page, ['select[name*="country" i]', 'select[id*="country" i]'], /germany|united states|usa|viet/i);
  await selectFirstAvailable(page, ['select[name*="lang" i]', 'select[id*="lang" i]', 'select[name*="language" i]', 'select[id*="language" i]'], /english|american english/i);
  await selectFirstAvailable(page, ['select[name="tz_date"]', "#tz_date"], /UTC\+07:00/i);
  await selectFirstAvailable(page, ['select[name="tz"]', "#timezone", 'select[name*="timezone" i]', 'select[id*="timezone" i]'], /Ho Chi Minh|Bangkok/i);
  await clickFirst(page, ["#tz_select_date_suggest", 'input[value*="UTC+07:00" i]']);
}

function getTargetDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function mapKnownLabelToValue(label: string, values: RegistrationFieldValues) {
  const normalized = label.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const securityAnswer = solveSecurityQuestion(normalized);
  if (securityAnswer) return securityAnswer;
  if (/captcha|recaptcha|hcaptcha|turnstile|confirmation code|verification code|security code|anti[- ]?spam/i.test(normalized)) {
    return null;
  }
  if (/confirm.*email|email.*confirm|repeat.*email|verify.*email/i.test(normalized)) return values.email;
  if (/e-?mail|email address|mail address/i.test(normalized)) return values.email;
  if (/confirm.*pass|pass.*confirm|repeat.*pass|verify.*pass/i.test(normalized)) return values.password;
  if (/new password|password|passwort|mot de passe|contrase/i.test(normalized)) return values.password;
  if (/user.?name|login name|screen name|display name|nickname|handle|member name/i.test(normalized)) return values.username;
  if (/first name|given name|forename/i.test(normalized)) return "AIC";
  if (/last name|family name|surname/i.test(normalized)) return "User";
  if (/full name|real name|your name|name/i.test(normalized)) return "AIC User";
  if (/phone|mobile|tel/i.test(normalized)) return "0900000000";
  if (/post.?code|postal|zip/i.test(normalized)) return "100000";
  if (/city|town/i.test(normalized)) return "Ho Chi Minh";
  if (/location|address/i.test(normalized)) return "Ho Chi Minh";
  if (/country|nation/i.test(normalized)) return "Vietnam";
  if (/website|web site|homepage|url|profile link/i.test(normalized)) return "https://example.com";
  if (/occupation|job|profession/i.test(normalized)) return "Member";
  if (/interest|bio|about|signature/i.test(normalized)) return "Technology";
  return null;
}

async function describeField(locator: Locator) {
  return locator
    .evaluate((element) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const id = field.id || "";
      const name = field.getAttribute("name") || "";
      const type = (field.getAttribute("type") || field.tagName).toLowerCase();
      const autocomplete = field.getAttribute("autocomplete") || "";
      const placeholder = field.getAttribute("placeholder") || "";
      const ariaLabel = field.getAttribute("aria-label") || "";
      const title = field.getAttribute("title") || "";
      const forLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || "" : "";
      const wrappedLabel = field.closest("label")?.textContent || "";
      const nearbyTexts: string[] = [];
      const addText = (value?: string | null) => {
        const text = (value || "").replace(/\s+/g, " ").trim();
        if (text && text.length < 700) nearbyTexts.push(text);
      };
      let current: HTMLElement | null = field;
      for (let level = 0; current && level < 7; level += 1) {
        addText(current.textContent);
        addText(current.previousElementSibling?.textContent);
        addText(current.parentElement?.previousElementSibling?.textContent);
        current = current.parentElement;
      }
      const rawRowText =
        field.closest("tr, .row, .form-row, .fields1, fieldset, dl, p, li, div, table")?.textContent?.replace(/\s+/g, " ").trim() || "";
      const rowText = rawRowText.length < 700 ? rawRowText : "";
      const selector = id
        ? `#${CSS.escape(id)}`
        : name
          ? `${field.tagName.toLowerCase()}[name="${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
          : "";
      return {
        tagName: field.tagName.toLowerCase(),
        type,
        name,
        selector,
        label: [forLabel, wrappedLabel, ariaLabel, placeholder, title, name, autocomplete, rowText, ...nearbyTexts]
          .filter(Boolean)
          .join(" "),
      };
    })
    .catch(() => null);
}

async function fieldIsEmpty(locator: Locator) {
  return locator
    .evaluate((element) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (field instanceof HTMLSelectElement) {
        return !field.value || /select|choose/i.test(field.selectedOptions[0]?.textContent || "");
      }
      if (field instanceof HTMLInputElement && /checkbox|radio/i.test(field.type)) return !field.checked;
      return !field.value.trim();
    })
    .catch(() => false);
}

async function fillFieldByLabel(page: Page, locator: Locator, label: string, values: RegistrationFieldValues) {
  const value = mapKnownLabelToValue(label, values);
  if (!value) return false;

  const description = await describeField(locator);
  if (!description) return false;
  if (description.tagName === "select") {
    const preferred = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const selected = await selectFirstAvailable(page, [description.selector].filter(Boolean), preferred);
    if (selected) return true;
    return selectFirstAvailable(page, [description.selector].filter(Boolean));
  }
  if (/checkbox|radio/i.test(description.type)) {
    if (/agree|terms|rules|policy|confirm/i.test(label)) {
      await locator.check({ force: true }).catch(() => undefined);
      await humanDelay(page);
      return true;
    }
    return false;
  }
  if (/file|submit|button|reset|image|hidden/i.test(description.type)) return false;

  await locator.click({ force: true }).catch(() => undefined);
  await humanDelay(page, 150, 450);
  await locator.fill(value).catch(() => undefined);
  await humanDelay(page);
  return true;
}

async function fillCachedSelectors(page: Page, domain: string, values: RegistrationFieldValues) {
  const selectors = DOMAIN_SELECTOR_CACHE.get(domain) ?? [];
  let filled = 0;
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0 || !(await locator.isVisible().catch(() => false)) || !(await fieldIsEmpty(locator))) continue;
    const description = await describeField(locator);
    if (!description) continue;
    if (await fillFieldByLabel(page, locator, description.label, values)) filled += 1;
  }
  return filled;
}

async function fillAllEmptyVisibleFields(page: Page, domain: string, values: RegistrationFieldValues) {
  let filled = await fillCachedSelectors(page, domain, values);
  const filledSelectors = new Set(DOMAIN_SELECTOR_CACHE.get(domain) ?? []);
  const fields = await page.locator("input, textarea, select").all();

  for (const field of fields) {
    if (!(await field.isVisible().catch(() => false)) || !(await field.isEnabled().catch(() => false))) continue;
    if (!(await fieldIsEmpty(field))) continue;
    const description = await describeField(field);
    if (!description || !description.selector) continue;
    if (await fillFieldByLabel(page, field, description.label, values)) {
      filled += 1;
      filledSelectors.add(description.selector);
    }
  }

  if (filledSelectors.size > 0) DOMAIN_SELECTOR_CACHE.set(domain, [...filledSelectors].slice(0, 40));
  return filled;
}

async function listEmptyVisibleRequiredFields(page: Page) {
  return page
    .locator("input, textarea, select")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const style = window.getComputedStyle(field);
          if (field.disabled || field.type === "hidden" || style.visibility === "hidden" || style.display === "none") return false;
          if (field.offsetWidth === 0 && field.offsetHeight === 0) return false;
          if (!field.required && field.getAttribute("aria-required") !== "true") return false;
          if (field instanceof HTMLSelectElement) return !field.value;
          if (field instanceof HTMLInputElement && /checkbox|radio/i.test(field.type)) return !field.checked;
          return !field.value.trim();
        })
        .map((element) => {
          const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          return field.getAttribute("name") || field.id || field.getAttribute("placeholder") || field.tagName.toLowerCase();
        })
        .slice(0, 8),
    )
    .catch(() => []);
}

function isMissingFieldError(text: string) {
  return /required|must be filled|required field|field is missing|please enter|please provide|cannot be empty|is empty|marked with .* required|báº¯t buá»™c|khÃ´ng Ä‘Æ°á»£c bá» trá»‘ng/i.test(
    text,
  );
}

export async function registerForumAccount(input: ForumRegistrationInput): Promise<ForumRegistrationResult> {
  const username = makeUsername(input.email);
  const password = makePassword();
  const context = await chromium.launchPersistentContext(AUTOMATION_PROFILE_DIR, {
    headless: false,
    channel: "chromium",
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Ho_Chi_Minh",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(page, 1000, 2500);
    const fieldValues = { email: input.email, username, password };

    if (!(await waitForChallengeToClear(page))) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "Automation browser Ä‘ang chá» báº¡n xá»­ lÃ½ challenge nhÆ°ng quÃ¡ thá»i gian 3 phÃºt.",
      };
    }

    const foundRegistrationUrl = await discoverRegistrationUrl(page, input.url);
    if (!foundRegistrationUrl) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "KhÃ´ng tÃ¬m tháº¥y URL/form Ä‘Äƒng kÃ½ sau khi probe tá»‘i Ä‘a 3 candidate.",
      };
    }

    const acceptedTerms = await acceptRegistrationTerms(page);

    if (!acceptedTerms && (await isTermsPage(page))) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "Äang á»Ÿ trang Ä‘iá»u khoáº£n nhÆ°ng khÃ´ng báº¥m Ä‘Æ°á»£c nÃºt Ä‘á»“ng Ã½.",
      };
    }

    const earlySecurityQuestionState = await ensureKnownSecurityQuestionAnswered(page);
    if (!earlySecurityQuestionState.ok) {
      const manualState = await waitForManualSecurityQuestion(page, earlySecurityQuestionState.note);
      if (!manualState.ok) {
        return {
          url: input.url,
          email: input.email,
          username,
          password,
          status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
          note: manualState.note,
        };
      }
    }

    const usernameField = await firstVisible(page, [
      'input[name="username"]',
      "#username",
      'input[autocomplete="username"]',
      'input[id*="username" i]',
      'input[name*="user" i]',
    ]);
    const emailField = await firstVisible(page, [
      'input[type="email"]',
      'input[name="email"]',
      "#email",
      'input[autocomplete="email"]',
      'input[id*="email" i]',
      'input[name*="email" i]',
    ]);

    const hasUsername = usernameField ? await fillFirst(page, ['input[name="username"]', "#username", 'input[autocomplete="username"]', 'input[id*="username" i]', 'input[name*="user" i]'], username) : false;
    const hasEmail = emailField ? await fillFirst(page, ['input[type="email"]', 'input[name="email"]', "#email", 'input[autocomplete="email"]', 'input[id*="email" i]', 'input[name*="email" i]'], input.email) : false;
    await fillFirst(page, ['input[name="email_confirm"]', 'input[name="confirm_email"]', "#email_confirm"], input.email);

    const passwordFields = await page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]').all();
    if (passwordFields.length > 0) {
      await passwordFields[0].click({ force: true }).catch(() => undefined);
      await humanDelay(page, 150, 450);
      await passwordFields[0].fill(password);
      await humanDelay(page);
    }
    if (passwordFields.length > 1) {
      await passwordFields[1].click({ force: true }).catch(() => undefined);
      await humanDelay(page, 150, 450);
      await passwordFields[1].fill(password);
      await humanDelay(page);
    }
    await fillFirst(page, ['input[name="new_password"]', "#new_password"], password);
    await fillFirst(page, ['input[name="password_confirm"]', 'input[name="confirm_password"]', "#password_confirm"], password);
    const accountFillSecurityQuestionState = await ensureKnownSecurityQuestionAnswered(page);
    if (!accountFillSecurityQuestionState.ok) {
      const manualState = await waitForManualSecurityQuestion(page, accountFillSecurityQuestionState.note);
      if (!manualState.ok) {
        return {
          url: input.url,
          email: input.email,
          username,
          password,
          status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
          note: manualState.note,
        };
      }
    }
    await fillProfileFields(page);
    const domain = getTargetDomain(page.url() || input.url);
    await answerKnownSecurityQuestion(page);
    await fillAllEmptyVisibleFields(page, domain, fieldValues);
    const answeredKnownQuestion = await answerKnownSecurityQuestion(page);
    const securityQuestionState = await ensureKnownSecurityQuestionAnswered(page);

    if (!hasUsername || !hasEmail || passwordFields.length === 0) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "KhÃ´ng tÃ¬m tháº¥y Ä‘á»§ trÆ°á»ng username/email/password.",
      };
    }

    if (!securityQuestionState.ok) {
      const manualState = await waitForManualSecurityQuestion(page, securityQuestionState.note);
      if (!manualState.ok) {
        return {
          url: input.url,
          email: input.email,
          username,
          password,
          status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
          note: manualState.note,
        };
      }
    }

    if (await hasCaptcha(page)) {
      const solved = securityQuestionState.present
        ? securityQuestionState.ok || (await waitForManualSecurityQuestion(page, securityQuestionState.note)).ok
        : answeredKnownQuestion || (await waitForManualCaptcha(page));
      if (!solved) {
        return {
          url: input.url,
          email: input.email,
          username,
          password,
          status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
          note: page.isClosed()
            ? "Cá»­a sá»• Chromium Ä‘Ã£ bá»‹ Ä‘Ã³ng trÆ°á»›c khi submit."
            : "ÄÃ£ Ä‘iá»n tÃ i khoáº£n nhÆ°ng quÃ¡ 3 phÃºt chÆ°a tháº¥y báº¡n nháº­p confirmation code/CAPTCHA.",
        };
      }
    }

    let submitted = false;
    let text = "";
    let success = false;
    let registrationError: string | null = null;
    let verifiedLoginNote = "";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const missingRequired = await listEmptyVisibleRequiredFields(page);
      if (missingRequired.length > 0) {
        await fillAllEmptyVisibleFields(page, domain, fieldValues);
        const retriedSecurityQuestionState = await ensureKnownSecurityQuestionAnswered(page);
        if (!retriedSecurityQuestionState.ok) {
          const manualState = await waitForManualSecurityQuestion(page, retriedSecurityQuestionState.note);
          if (!manualState.ok) {
            return {
              url: input.url,
              email: input.email,
              username,
              password,
              status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
              note: manualState.note,
            };
          }
        }
        const stillMissingRequired = await listEmptyVisibleRequiredFields(page);
        if (stillMissingRequired.length > 0) {
          return {
            url: input.url,
            email: input.email,
            username,
            password,
            status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
            note: `CÃ²n field báº¯t buá»™c chÆ°a Ä‘iá»n Ä‘Æ°á»£c trÆ°á»›c submit: ${stillMissingRequired.join(", ")}.`,
          };
        }
      }

      const preSubmitSecurityQuestionState = await ensureKnownSecurityQuestionAnswered(page);
      if (!preSubmitSecurityQuestionState.ok) {
        const manualState = await waitForManualSecurityQuestion(page, preSubmitSecurityQuestionState.note);
        if (!manualState.ok) {
          return {
            url: input.url,
            email: input.email,
            username,
            password,
            status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
            note: manualState.note,
          };
        }
      }

      await humanDelay(page, 800, 2000);
      submitted = await submitRegistrationForm(page, emailField ?? usernameField);

    if (!submitted) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "KhÃ´ng tÃ¬m tháº¥y nÃºt submit Ä‘Äƒng kÃ½.",
      };
    }

    if (page.isClosed()) {
      return {
        url: input.url,
        email: input.email,
        username,
        password,
        status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
        note: "Cá»­a sá»• Chromium Ä‘Ã£ bá»‹ Ä‘Ã³ng ngay sau khi submit, khÃ´ng xÃ¡c nháº­n Ä‘Æ°á»£c káº¿t quáº£.",
      };
    }

      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
      await safeWait(page, 1500);
      text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
      const submissionAccepted = isSuccessfulSubmission(text);
      if (submissionAccepted) {
        const loginCheck = await verifyLoginWorks(page, input.url, username, password);
        success = loginCheck.ok;
        verifiedLoginNote = loginCheck.note;
        registrationError = success ? null : loginCheck.note;
        break;
      }
      registrationError = extractRegistrationError(text);
      if (!isMissingFieldError(text) || attempt === 3) break;
      await fillAllEmptyVisibleFields(page, domain, fieldValues);
    }

    return {
      url: input.url,
      email: input.email,
      username,
      password,
      status: success ? "ÄÄƒng kÃ½ Ä‘Æ°á»£c" : "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
      note: success ? verifiedLoginNote || "Đăng ký thành công và đăng nhập kiểm tra được." : registrationError ?? "Submit xong nhưng không xác minh được tài khoản đăng nhập thành công.",
    };
  } catch (error) {
    return {
      url: input.url,
      email: input.email,
      username,
      password,
      status: "KhÃ´ng Ä‘Äƒng kÃ½ Ä‘Æ°á»£c",
      note: error instanceof Error ? error.message : "Unknown registration error",
    };
  } finally {
    await context.close();
  }
}
