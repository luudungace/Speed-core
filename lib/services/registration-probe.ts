import type { RegistrationProbeResult } from "@/lib/types/registration";

const LINK_HINT_RE = /register|signup|sign-up|join|create-account|dang-ky|đăng ký|注册|登録|registr/i;

function getScore(input: {
  url: string;
  hasEmailField: boolean;
  hasPasswordField: boolean;
  hasSubmit: boolean;
  candidateLinks: string[];
}) {
  let score = 0;
  if (LINK_HINT_RE.test(input.url)) score += 30;
  if (input.hasEmailField) score += 20;
  if (input.hasPasswordField) score += 20;
  if (input.hasSubmit) score += 15;
  if (input.candidateLinks.length > 0) score += 10;
  if (!input.hasEmailField && !input.hasPasswordField) score -= 25;
  return Math.max(0, score);
}

function resolveHref(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function probeRegistrationUrl(url: string): Promise<RegistrationProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = response.url || url;
    const html = await response.text();
    const lowerHtml = html.toLowerCase();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 160) ?? null;
    const hasEmailField = /<input[^>]+type=["']?email/i.test(html) || /<input[^>]+(?:name|id)=["'][^"']*email/i.test(html);
    const hasPasswordField =
      /<input[^>]+type=["']?password/i.test(html) || /<input[^>]+(?:name|id)=["'][^"']*pass/i.test(html);
    const hasSubmit = /<button[^>]+type=["']?submit/i.test(html) || /<input[^>]+type=["']?submit/i.test(html);
    const formCount = (lowerHtml.match(/<form\b/g) ?? []).length;
    const candidateLinks = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
      .map((match) => match[1])
      .filter((href) => LINK_HINT_RE.test(href))
      .map((href) => resolveHref(href, finalUrl))
      .filter((href): href is string => Boolean(href))
      .slice(0, 8);

    const score = getScore({ url: finalUrl, hasEmailField, hasPasswordField, hasSubmit, candidateLinks });
    const ok = formCount > 0 && hasEmailField && hasSubmit;
    const hasLoginOnlyShape = hasPasswordField && !hasEmailField && /login|signin|sign-in/i.test(finalUrl);
    const status = ok ? "verified" : hasLoginOnlyShape || score < 35 ? "no_register_form" : "manual_review";

    return {
      ok,
      finalUrl,
      score,
      status,
      failureCode: ok ? null : status === "no_register_form" ? "no_register_form" : "needs_manual_review",
      evidence: {
        hasEmailField,
        hasPasswordField,
        hasSubmit,
        formCount,
        candidateLinks,
        title,
      },
    };
  } catch (error) {
    return {
      ok: false,
      finalUrl: url,
      score: 0,
      status: "manual_review",
      failureCode: error instanceof Error ? error.message : "probe_failed",
      evidence: {
        hasEmailField: false,
        hasPasswordField: false,
        hasSubmit: false,
        formCount: 0,
        candidateLinks: [],
        title: null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
