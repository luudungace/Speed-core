type AuthLinkInput = {
  url: string;
  domain: string;
  cmsType?: string | null;
};

function getOrigin(input: AuthLinkInput) {
  try {
    return new URL(input.url).origin;
  } catch {
    return `https://${input.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]}`;
  }
}

const REGISTER_PATH_HINTS = [
  "register",
  "registration",
  "registrace",
  "signup",
  "sign-up",
  "sign_up",
  "join",
  "create-account",
  "create_account",
  "member/register",
  "members/register",
  "user/register",
  "users/register",
  "users/sign_up",
  "student-registration",
  "employer-registration",
  "login-register",
  "authentication",
  "dang-ky",
  "dangky",
  "inscription",
  "registrarse",
];

function normalizeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLikelyRegisterUrl(url: string) {
  const parsed = normalizeUrl(url);
  if (!parsed) return false;

  const pathname = decodeURIComponent(parsed.pathname).toLowerCase();
  const search = decodeURIComponent(parsed.search).toLowerCase();
  const haystack = `${pathname}${search}`;
  const action = parsed.searchParams.get("action")?.toLowerCase() ?? "";
  const mode = parsed.searchParams.get("mode")?.toLowerCase() ?? "";
  const wpforo = parsed.searchParams.get("wpforo")?.toLowerCase() ?? "";

  if (pathname.endsWith("/wp-login.php") && action === "register") return true;
  if (pathname.endsWith("/register.php")) return true;
  if (pathname.endsWith("/ucp.php") && mode === "register") return true;
  if (wpforo === "signup" || wpforo === "register") return true;
  if (search.includes("register=yes")) return true;

  return REGISTER_PATH_HINTS.some((hint) => haystack.includes(hint));
}

export function isLikelyLoginOnlyUrl(url: string) {
  const parsed = normalizeUrl(url);
  if (!parsed) return false;
  if (isLikelyRegisterUrl(url)) return false;

  const pathname = decodeURIComponent(parsed.pathname).toLowerCase().replace(/\/+$/, "");
  const search = decodeURIComponent(parsed.search).toLowerCase();
  const segments = pathname.split("/").filter(Boolean);
  const mode = parsed.searchParams.get("mode")?.toLowerCase() ?? "";

  if (pathname.endsWith("/wp-login.php")) return true;
  if (pathname.endsWith("/login.php")) return true;
  if (pathname.endsWith("/ucp.php") && mode === "login") return true;
  if (segments.some((segment) => ["login", "signin", "sign-in", "sign_in", "log-in"].includes(segment))) return true;
  if (search.includes("redirect=") && /(dashboard|account|login|signin)/i.test(search)) return true;

  return false;
}

export function getAuthLinks(input: AuthLinkInput) {
  const origin = getOrigin(input);

  switch (input.cmsType) {
    case "WordPress":
      return {
        register: `${origin}/wp-login.php?action=register`,
        login: `${origin}/wp-login.php`,
      };
    case "vBulletin":
      return {
        register: `${origin}/register.php`,
        login: `${origin}/login.php?do=login`,
      };
    case "phpBB":
      return {
        register: `${origin}/ucp.php?mode=register`,
        login: `${origin}/ucp.php?mode=login`,
      };
    case "XenForo":
    default:
      return {
        register: `${origin}/register`,
        login: `${origin}/login`,
      };
  }
}

export function getCrawlerRegisterLink(input: AuthLinkInput) {
  if (isLikelyLoginOnlyUrl(input.url)) return "";
  if (isLikelyRegisterUrl(input.url)) return input.url;
  if (input.cmsType && input.cmsType !== "Unknown") return getAuthLinks(input).register;
  return "";
}
