import imapSimple from "imap-simple";
import { simpleParser } from "mailparser";
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

const VERIFIED_STATUS = "Đã xác nhận email";
const FAILED_STATUS = "Không xác nhận được";

type VerificationResult = {
  status: typeof VERIFIED_STATUS | typeof FAILED_STATUS;
  note: string;
  verificationUrl?: string;
};

const VERIFY_PROFILE_DIR = ".playwright-email-verify-profile";

function scoreVerificationLink(link: string, domain: string) {
  let score = 0;
  const lower = link.toLowerCase();
  if (domain && lower.includes(domain.toLowerCase())) score += 20;
  if (/activate|activation|verify|verification|confirm|validate|email|registrierung/i.test(lower)) score += 40;
  if (/ucp\.php.*mode=activate|account.*activate|confirm.*email/i.test(lower)) score += 40;
  if (/unsubscribe|privacy|terms|login|reset|password/i.test(lower)) score -= 50;
  return score;
}

async function extractLinksFromEmail(message: imapSimple.Message): Promise<string[]> {
  const allParts = message.parts.find((p) => p.which === "");
  if (!allParts || !allParts.body) return [];

  try {
    const parsed = await simpleParser(allParts.body);
    const bodyText = parsed.text || "";
    const bodyHtml = parsed.html || "";
    const fullContent = bodyText + " " + bodyHtml;

    const hrefLinks = [...fullContent.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
    const plainLinks = [...fullContent.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)].map((match) => match[0]);

    return [...new Set([...hrefLinks, ...plainLinks].map((link) => link.replace(/&amp;/g, "&").replace(/[.,;]+$/g, "")))];
  } catch (error) {
    console.error("Lỗi khi parse email body:", error);
    return [];
  }
}

async function fetchRecentMessagesFromImap(credentials: ImapCredentials, domain: string): Promise<string[]> {
  const config = {
    imap: {
      user: credentials.email,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port,
      tls: true,
      authTimeout: 15000,
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  let connection: imapSimple.ImapSimple;
  try {
    connection = await imapSimple.connect(config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Đăng nhập IMAP thất bại: ${msg}`);
  }

  try {
    const foldersToTry = [
      "INBOX",
      "Spam",
      "Junk",
      "[Gmail]/Spam",
      "[Gmail]/Junk",
      "[Gmail]/Thư rác",
      "[Gmail]/All Mail",
      "All Mail",
    ];

    const since = new Date();
    since.setDate(since.getDate() - 14); // Tìm trong vòng 14 ngày qua

    const allLinks: string[] = [];

    for (const folder of foldersToTry) {
      try {
        await connection.openBox(folder);
        const searchCriteria = ["ALL"];
        const fetchOptions = {
          bodies: ["HEADER", ""],
          struct: true,
        };

        const results = await connection.search(searchCriteria, fetchOptions);
        for (const msg of results) {
          const headerPart = msg.parts.find((p) => p.which === "HEADER");
          if (!headerPart || !headerPart.body) continue;

          const parsedHeader = await simpleParser(headerPart.body);
          const fromHeader = (parsedHeader.from?.text || "").toLowerCase();
          const subject = (parsedHeader.subject || "").toLowerCase();
          const date = parsedHeader.date || new Date();

          const matchesContext =
            date >= since &&
            (fromHeader.includes(domain.toLowerCase()) ||
              subject.includes("activation") ||
              subject.includes("confirm") ||
              subject.includes("registrierung") ||
              subject.includes("activate") ||
              subject.includes("xác minh") ||
              subject.includes("kích hoạt") ||
              subject.includes(domain.toLowerCase()));

          if (matchesContext) {
            const links = await extractLinksFromEmail(msg);
            allLinks.push(...links);
          }
        }
      } catch (err) {
        // Bỏ qua lỗi nếu folder không tồn tại trên server
      }
    }

    return [...new Set(allLinks)];
  } finally {
    try {
      connection.end();
    } catch {
      // Bỏ qua lỗi khi kết thúc connection
    }
  }
}

async function openVerificationLink(link: string): Promise<string> {
  const browser = await chromium.launchPersistentContext(VERIFY_PROFILE_DIR, {
    headless: false,
    channel: "chromium",
    viewport: { width: 1280, height: 850 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(4000);
    const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (/activated|verified|confirmed|registration complete|account is now active|thank you|success|kích hoạt|thành công/i.test(text)) {
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
    // 1. Thử dùng Gmail API trước
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

    // 2. Thử dùng IMAP nếu Gmail API không tìm thấy hoặc thất bại
    const links = await fetchRecentMessagesFromImap({
      email: emailResource.email,
      password: emailResource.password,
      host: emailResource.imapHost,
      port: Number(emailResource.imapPort) || 993,
    }, account.domain);

    const bestLink = links
      .map((link) => ({ link, score: scoreVerificationLink(link, account.domain) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.link;

    if (!bestLink) {
      const note = "Đăng nhập IMAP được nhưng không tìm thấy link xác nhận trong email 14 ngày gần đây.";
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
