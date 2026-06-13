import type { CrawlResultRow } from "@/lib/types/crawler";
import { getBacklinkCandidateFromRaw } from "@/lib/utils/backlink-candidate";
import { isRegistrationFound } from "@/lib/utils/registration-opportunity";

const REGISTER_PATH_RE =
  /\/(register|registration|signup|sign-up|join|create-account|confirm-email|new-user)(\/|$|\?|-)|mode=register|action=register/i;
const LOGIN_ONLY_RE = /\/(login|signin|sign-in)(\/|$|\?)|mode=login|action=login/i;

function originOf(url: string) {
  return new URL(url).origin;
}

function cmsRegisterUrl(cmsType: string, origin: string) {
  switch (cmsType) {
    case "XenForo":
      return `${origin}/register`;
    case "WordPress":
      return `${origin}/wp-login.php?action=register`;
    case "vBulletin":
      return `${origin}/register.php`;
    case "phpBB":
      return `${origin}/ucp.php?mode=register`;
    default:
      return null;
  }
}

export function getCrawlerRegisterLink(row: Pick<CrawlResultRow, "url" | "cms_type" | "error" | "raw_serper_data">) {
  const url = row.url.trim();
  if (!/^https?:\/\//i.test(url)) return null;

  if (LOGIN_ONLY_RE.test(url) && !REGISTER_PATH_RE.test(url)) return null;
  if (REGISTER_PATH_RE.test(url)) return url;

  const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);
  const registrationFromCandidate = candidate?.registration_urls?.[0]?.url;
  if (registrationFromCandidate) return registrationFromCandidate;

  if (row.cms_type && row.cms_type !== "Unknown") {
    try {
      return cmsRegisterUrl(row.cms_type, originOf(url));
    } catch {
      return null;
    }
  }

  return null;
}

export function hasCrawlerRegisterLink(row: Pick<CrawlResultRow, "url" | "cms_type" | "error" | "raw_serper_data">) {
  return Boolean(getCrawlerRegisterLink(row)) || isRegistrationFound(row.error);
}
