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
  const currentUrlLooksRegister = /register|signup|sign-up|join|create-account/i.test(input.url);
  if (currentUrlLooksRegister) return input.url;
  if (input.cmsType && input.cmsType !== "Unknown") return getAuthLinks(input).register;
  return "";
}
