import type { CmsType } from "@/lib/types/crawler";

export type CandidateSiteType = "Forum" | "Social" | "Web 2.0" | "Article" | "Directory" | "File" | "Unknown";

export type CandidateLink = {
  url: string;
  text: string;
};

export type BacklinkCandidate = {
  is_candidate: boolean;
  status: "candidate" | "unlikely";
  score: number;
  site_type: CandidateSiteType;
  evidence: string[];
  registration_urls: CandidateLink[];
  login_urls: CandidateLink[];
  submit_urls: CandidateLink[];
  profile_urls: CandidateLink[];
  note: string;
};

export type PageLink = {
  href: string;
  text?: string;
};

const REGISTER_TEXT = [
  "register",
  "registration",
  "sign up",
  "signup",
  "create account",
  "create an account",
  "join now",
  "join us",
  "become a member",
];

const POST_TEXT = [
  "new thread",
  "post thread",
  "post reply",
  "reply to thread",
  "start new topic",
  "create thread",
  "submit thread",
  "new topic",
  "post a new topic",
  "submit article",
  "write for us",
  "contribute",
  "submit post",
  "submit your site",
  "add website",
  "add listing",
];

const FORUM_POST_TEXT = [
  "new thread",
  "post thread",
  "post reply",
  "reply to thread",
  "start new topic",
  "create thread",
  "new topic",
  "post a new topic",
];

const PROFILE_TEXT = [
  "profile",
  "signature",
  "website url",
  "homepage",
  "bio",
  "about me",
  "personal website",
];

const FORUM_TEXT = ["forum", "forums", "thread", "topic", "memberlist", "viewforum.php", "showthread"];
const SOCIAL_TEXT = ["community", "group", "groups", "members", "profile", "activity feed", "followers"];
const WEB2_TEXT = ["blog", "wordpress", "wp-content", "author", "dashboard", "publish"];
const ARTICLE_TEXT = ["write for us", "guest post", "submit article", "contributor"];
const DIRECTORY_TEXT = ["directory", "submit your site", "add website", "add listing", "business listing"];

const REGISTER_PATH_RE = /\/(register|registration|signup|sign-up|join|create-account|confirm-email|new-user)(\/|$|\?|-)/i;
const LOGIN_PATH_RE = /\/(login|log-in|signin|sign-in|account)(\/|$|\?)/i;
const SUBMIT_PATH_RE = /\/(submit|new-thread|post-thread|new-topic|create-thread|reply|post-reply|write-for-us|contribute|add-website|add-listing)(\/|$|\?|-)/i;
const FORUM_POST_PATH_RE = /\/(new-thread|post-thread|new-topic|create-thread|reply|post-reply)(\/|$|\?|-)/i;
const PROFILE_PATH_RE = /\/(profile|members|account|user|users|signature)(\/|$|\?)/i;
const NON_PAGE_PATH_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|jpg|jpeg|png|gif|webp|svg|css|js|json|xml|rss|txt)(\?|#|$)/i;

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function uniqueLinks(links: CandidateLink[]) {
  const seen = new Set<string>();
  return links
    .filter((link) => {
      if (!link.url || seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, 5);
}

function classifySiteType(haystack: string, cmsType: CmsType): CandidateSiteType {
  if (["XenForo", "vBulletin", "phpBB"].includes(cmsType) || includesAny(haystack, FORUM_TEXT)) return "Forum";
  if (includesAny(haystack, ARTICLE_TEXT)) return "Article";
  if (includesAny(haystack, DIRECTORY_TEXT)) return "Directory";
  if (cmsType === "WordPress" || includesAny(haystack, WEB2_TEXT)) return "Web 2.0";
  if (includesAny(haystack, SOCIAL_TEXT)) return "Social";
  return "Unknown";
}

function normalizeCandidateLink(link: PageLink): CandidateLink {
  return {
    url: link.href,
    text: (link.text ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
  };
}

function isForumPostingLink(link: CandidateLink) {
  return FORUM_POST_PATH_RE.test(link.url) || includesAny(link.text.toLowerCase(), FORUM_POST_TEXT);
}

export function detectBacklinkCandidate(input: {
  url: string;
  html?: string | null;
  text?: string | null;
  cmsType: CmsType;
  links?: PageLink[];
}): BacklinkCandidate {
  const haystack = [input.url, input.html, input.text].filter(Boolean).join("\n").toLowerCase();
  const links = input.links ?? [];
  const currentLink = { href: input.url, text: "Current URL" };
  const evidence: string[] = [];
  let score = 0;

  if (NON_PAGE_PATH_RE.test(input.url)) {
    return {
      is_candidate: false,
      status: "unlikely",
      score: 0,
      site_type: "File",
      evidence: ["non-page file URL"],
      registration_urls: [],
      login_urls: [],
      submit_urls: [],
      profile_urls: [],
      note: "Static files are not self-created backlink targets.",
    };
  }

  const registrationUrls = uniqueLinks(
    [currentLink, ...links]
      .filter((link) => REGISTER_PATH_RE.test(link.href) || includesAny(`${link.text ?? ""}`.toLowerCase(), REGISTER_TEXT))
      .map(normalizeCandidateLink),
  );
  const loginUrls = uniqueLinks(
    [currentLink, ...links]
      .filter((link) => LOGIN_PATH_RE.test(link.href) || includesAny(`${link.text ?? ""}`.toLowerCase(), ["login", "log in", "sign in"]))
      .map(normalizeCandidateLink),
  );
  const submitUrls = uniqueLinks(
    [currentLink, ...links]
      .filter((link) => SUBMIT_PATH_RE.test(link.href) || includesAny(`${link.text ?? ""}`.toLowerCase(), POST_TEXT))
      .map(normalizeCandidateLink),
  );
  const profileUrls = uniqueLinks(
    [currentLink, ...links]
      .filter((link) => PROFILE_PATH_RE.test(link.href) || includesAny(`${link.text ?? ""}`.toLowerCase(), PROFILE_TEXT))
      .map(normalizeCandidateLink),
  );
  const siteType = classifySiteType(haystack, input.cmsType);

  if (siteType !== "Unknown") {
    score += 20;
    evidence.push(`site type signal: ${siteType}`);
  }
  if (["XenForo", "vBulletin", "phpBB"].includes(input.cmsType)) {
    score += 25;
    evidence.push(`forum CMS detected: ${input.cmsType}`);
  }
  if (registrationUrls.length > 0) {
    score += 25;
    evidence.push("registration URL found");
  } else if (includesAny(haystack, REGISTER_TEXT)) {
    score += 10;
    evidence.push("registration text only");
  }
  if (loginUrls.length > 0) {
    score += 10;
    evidence.push("login link found");
  }
  const hasForumPostingUrl = siteType === "Forum" && submitUrls.some(isForumPostingLink);
  if (hasForumPostingUrl) {
    score += 40;
    evidence.push("forum posting URL found");
  } else if (submitUrls.length > 0) {
    score += siteType === "Forum" ? 25 : 15;
    evidence.push(siteType === "Forum" ? "forum submission URL found" : "posting/submission URL found");
  } else if (includesAny(haystack, POST_TEXT)) {
    score += siteType === "Forum" ? 8 : 5;
    evidence.push("posting/submission text only");
  }
  if (profileUrls.length > 0) {
    score += 15;
    evidence.push("profile/link placement URL found");
  } else if (includesAny(haystack, PROFILE_TEXT)) {
    score += 5;
    evidence.push("profile/link placement text only");
  }

  const finalScore = Math.min(score, 100);
  const hasActionEntry = registrationUrls.length > 0 || submitUrls.length > 0 || profileUrls.length > 0;
  const hasStrongForumEngine = ["XenForo", "vBulletin", "phpBB"].includes(input.cmsType);
  const isCandidate = finalScore >= 35 && (hasForumPostingUrl || hasActionEntry || hasStrongForumEngine);

  return {
    is_candidate: isCandidate,
    status: isCandidate ? "candidate" : "unlikely",
    score: finalScore,
    site_type: siteType,
    evidence: [...new Set(evidence)],
    registration_urls: registrationUrls,
    login_urls: loginUrls,
    submit_urls: submitUrls,
    profile_urls: profileUrls,
    note: "Candidate only. Registration, posting permission, and link placement are not verified.",
  };
}

export function getBacklinkCandidateFromRaw(raw: Record<string, unknown> | null | undefined): BacklinkCandidate | null {
  const value = raw?.backlink_candidate;
  if (!value || typeof value !== "object") return null;
  return value as BacklinkCandidate;
}
