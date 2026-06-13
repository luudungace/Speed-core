import tls from "node:tls";
import { chromium } from "playwright";
import { findGmailApiVerificationLink } from "@/lib/services/gmail-api-service";
import { readRegisteredAccounts, updateRegisteredAccountEmailVerification } from "@/lib/services/registration-queue-store";
import { readEmailPool } from "@/lib/services/resource-store";

type ImapCredentials = {
  email: string;
  password: string;
  host: string;
  port: number;
};

const VERIFIED_STATUS = "\u0110\u00e3 x\u00e1c nh\u1eadn email";
const FAILED_STATUS = "Kh\u00f4ng x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c";

type VerificationResult = {
  status: typeof VERIFIED_STATUS | typeof FAILED_STATUS;
  note: string;
  verificationUrl?: string;
};

const VERIFY_PROFILE_DIR = ".playwright-email-verify-profile";

function quoteImap(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function waitFor(socket: tls.TLSSocket, tag: string, timeoutMs = 20000) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`IMAP timeout while waiting for ${tag}.`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      buffer += chunk.toString("binary");
      if (new RegExp(`(^|\\r?\\n)${tag} (OK|NO|BAD)`, "i").test(buffer)) {
        cleanup();
        resolve(buffer);
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: tls.TLSSocket, counter: { value: number }, command: string, timeoutMs?: number) {
  counter.value += 1;
  const tag = `A${String(counter.value).padStart(4, "0")}`;
  const pending = waitFor(socket, tag, timeoutMs);
  socket.write(`${tag} ${command}\r\n`);
  const response = await pending;
  if (!new RegExp(`(^|\\r?\\n)${tag} OK`, "i").test(response)) {
    const line = response.split(/\r?\n/).find((row) => row.startsWith(tag)) ?? response.slice(-300);
    throw new Error(line.trim());
  }
  return response;
}

function formatImapDate(date: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function parseSearchUids(response: string) {
  const line = response.split(/\r?\n/).find((row) => /^\* SEARCH/i.test(row)) ?? "";
  return line
    .replace(/^\* SEARCH\s*/i, "")
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeEmailBody(raw: string) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const parts = [normalized, decodeQuotedPrintable(normalized)];
  const base64Matches = normalized.match(/[A-Za-z0-9+/=\r\n]{120,}/g) ?? [];
  for (const match of base64Matches.slice(0, 8)) {
    try {
      parts.push(Buffer.from(match.replace(/\s+/g, ""), "base64").toString("utf8"));
    } catch {
      // Ignore invalid encoded chunks.
    }
  }
  return parts.join("\n");
}

function extractLinks(text: string) {
  const hrefLinks = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const plainLinks = [...text.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)].map((match) => match[0]);
  return [...new Set([...hrefLinks, ...plainLinks].map((link) => link.replace(/&amp;/g, "&").replace(/[.,;]+$/g, "")))];
}

function scoreVerificationLink(link: string, domain: string) {
  let score = 0;
  const lower = link.toLowerCase();
  if (domain && lower.includes(domain.toLowerCase())) score += 20;
  if (/activate|activation|verify|verification|confirm|validate|email/.test(lower)) score += 40;
  if (/ucp\.php.*mode=activate|account.*activate|confirm.*email/.test(lower)) score += 40;
  if (/unsubscribe|privacy|terms|login|reset|password/.test(lower)) score -= 50;
  return score;
}

async function fetchRecentMessages(credentials: ImapCredentials) {
  const socket = tls.connect({ host: credentials.host, port: credentials.port, servername: credentials.host });
  const counter = { value: 0 };
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("IMAP greeting timeout.")), 12000);
    socket.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("error", reject);
  });

  try {
    await sendCommand(socket, counter, `LOGIN ${quoteImap(credentials.email)} ${quoteImap(credentials.password)}`);
    await sendCommand(socket, counter, "SELECT INBOX");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const search = await sendCommand(socket, counter, `UID SEARCH SINCE ${formatImapDate(since)}`);
    const uids = parseSearchUids(search).slice(-30).reverse();
    const messages: string[] = [];
    for (const uid of uids) {
      const response = await sendCommand(socket, counter, `UID FETCH ${uid} BODY.PEEK[]`, 30000).catch(() => "");
      if (response) messages.push(response);
    }
    await sendCommand(socket, counter, "LOGOUT").catch(() => "");
    return messages;
  } finally {
    socket.end();
  }
}

async function openVerificationLink(link: string) {
  const browser = await chromium.launchPersistentContext(VERIFY_PROFILE_DIR, {
    headless: false,
    channel: "chromium",
    viewport: { width: 1280, height: 850 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (/activated|verified|confirmed|registration complete|account is now active|thank you|success/i.test(text)) {
      return "Mở link xác nhận thành công.";
    }
    return "Đã mở link xác nhận, cần kiểm tra lại nội dung trang.";
  } finally {
    await browser.close();
  }
}

export async function verifyRegisteredAccountEmail(accountId: string): Promise<VerificationResult> {
  const accounts = await readRegisteredAccounts();
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return { status: FAILED_STATUS, note: "Không tìm thấy account đã đăng ký." };

  const emailPool = await readEmailPool();
  const emailResource = emailPool.find((item) => item.email === account.email.toLowerCase().trim());
  if (!emailResource) {
    const note = "Email không còn nằm trong Email Pool nên không có password/IMAP để xác nhận.";
    await updateRegisteredAccountEmailVerification(account.id, { emailVerificationStatus: FAILED_STATUS, emailVerificationNote: note });
    return { status: FAILED_STATUS, note };
  }

  try {
    const gmailApiResult = await findGmailApiVerificationLink(account.email, account.domain);
    if (gmailApiResult.status === "found") {
      const note = await openVerificationLink(gmailApiResult.link);
      await updateRegisteredAccountEmailVerification(account.id, {
        emailVerificationStatus: VERIFIED_STATUS,
        emailVerificationNote: `Gmail API: ${note}`,
        emailVerifiedAt: new Date().toISOString(),
      });
      return { status: VERIFIED_STATUS, note: `Gmail API: ${note}`, verificationUrl: gmailApiResult.link };
    }

    if (!emailResource.password) {
      const note = `Gmail API: ${gmailApiResult.note}. Email trong Email Pool chưa có password để fallback IMAP.`;
      await updateRegisteredAccountEmailVerification(account.id, { emailVerificationStatus: FAILED_STATUS, emailVerificationNote: note });
      return { status: FAILED_STATUS, note };
    }

    const messages = await fetchRecentMessages({
      email: emailResource.email,
      password: emailResource.password,
      host: emailResource.imapHost,
      port: Number(emailResource.imapPort) || 993,
    });
    const decoded = messages.map(decodeEmailBody);
    const links = decoded.flatMap(extractLinks);
    const bestLink = links
      .map((link) => ({ link, score: scoreVerificationLink(link, account.domain) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.link;

    if (!bestLink) {
      const note = "Đăng nhập IMAP được nhưng không tìm thấy link xác nhận trong email 7 ngày gần đây.";
      await updateRegisteredAccountEmailVerification(account.id, { emailVerificationStatus: FAILED_STATUS, emailVerificationNote: note });
      return { status: FAILED_STATUS, note };
    }

    const note = await openVerificationLink(bestLink);
    await updateRegisteredAccountEmailVerification(account.id, {
      emailVerificationStatus: VERIFIED_STATUS,
      emailVerificationNote: note,
      emailVerifiedAt: new Date().toISOString(),
    });
    return { status: VERIFIED_STATUS, note, verificationUrl: bestLink };
  } catch (error) {
    const note = error instanceof Error ? error.message : "Unknown IMAP verification error.";
    await updateRegisteredAccountEmailVerification(account.id, { emailVerificationStatus: FAILED_STATUS, emailVerificationNote: note });
    return { status: FAILED_STATUS, note };
  }
}
