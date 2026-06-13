export type ManualReviewReason = "captcha" | "cloudflare" | "login_wall" | "blocked";

const MANUAL_REVIEW_PREFIX = "NEEDS_MANUAL_REVIEW";

const REASON_LABELS: Record<ManualReviewReason, string> = {
  captcha: "CAPTCHA",
  cloudflare: "Cloudflare",
  login_wall: "Login wall",
  blocked: "Blocked",
};

const CAPTCHA_PATTERNS = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "verify you are human",
  "i am not a robot",
  "i'm not a robot",
];

const CLOUDFLARE_PATTERNS = [
  "cloudflare",
  "checking your browser",
  "just a moment",
  "cf-challenge",
  "cf-turnstile",
];

const LOGIN_WALL_PATTERNS = [
  "please log in",
  "please login",
  "log in to continue",
  "login to continue",
  "sign in to continue",
  "you must be logged in",
  "members only",
  "login required",
];

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

export function detectManualReviewReason(input: {
  title?: string | null;
  html?: string | null;
  text?: string | null;
  error?: string | null;
}): ManualReviewReason | null {
  const haystack = [input.title, input.html, input.text, input.error]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (!haystack) return null;
  if (includesAny(haystack, CAPTCHA_PATTERNS)) return "captcha";
  if (includesAny(haystack, CLOUDFLARE_PATTERNS)) return "cloudflare";
  if (includesAny(haystack, LOGIN_WALL_PATTERNS)) return "login_wall";
  if (haystack.includes("access denied") || haystack.includes("forbidden")) return "blocked";
  return null;
}

export function formatManualReviewError(reason: ManualReviewReason) {
  return `${MANUAL_REVIEW_PREFIX}: ${REASON_LABELS[reason]}`;
}

export function getManualReviewReason(error: string | null | undefined) {
  if (!error?.startsWith(`${MANUAL_REVIEW_PREFIX}: `)) return null;
  return error.slice(`${MANUAL_REVIEW_PREFIX}: `.length);
}

export function isManualReviewError(error: string | null | undefined) {
  return getManualReviewReason(error) !== null;
}
