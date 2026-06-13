const REGISTER_FOUND_PREFIX = "REGISTER_FOUND";
const REGISTER_NOT_FOUND_PREFIX = "REGISTER_NOT_FOUND";

const REGISTER_PATTERNS = [
  "register",
  "registration",
  "sign up",
  "signup",
  "sign-up",
  "create account",
  "create an account",
  "join now",
  "join us",
  "become a member",
  "new account",
  "post thread",
  "new thread",
];

export function detectRegistrationOpportunity(input: {
  html?: string | null;
  text?: string | null;
  url?: string | null;
}) {
  const haystack = [input.url, input.html, input.text].filter(Boolean).join("\n").toLowerCase();
  return REGISTER_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export function formatRegistrationStatus(found: boolean) {
  return found ? REGISTER_FOUND_PREFIX : REGISTER_NOT_FOUND_PREFIX;
}

export function getRegistrationStatus(error: string | null | undefined) {
  if (error === REGISTER_FOUND_PREFIX) return "Có đăng ký";
  if (error === REGISTER_NOT_FOUND_PREFIX) return "Chưa thấy";
  return null;
}

export function isRegistrationFound(error: string | null | undefined) {
  return error === REGISTER_FOUND_PREFIX;
}
