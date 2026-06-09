export type RegistrationUrlStatus = "candidate" | "verified" | "no_register_form" | "manual_review" | "blocked";

export type RegistrationJobState =
  | "discover"
  | "url_verified"
  | "manual_review"
  | "awaiting_email"
  | "click_verify"
  | "set_password"
  | "active"
  | "failed";

export type RegistrationAccountStatus = "manual_saved" | "active" | "needs_verification" | "failed";

export type SiteProfileRow = {
  id: string;
  created_at: string;
  updated_at: string;
  domain: string;
  register_url: string | null;
  cms_type: string;
  verification_pattern: string | null;
  requires_verification: boolean | null;
  disposable_blocked: boolean;
  cooldown_until: string | null;
  mail_delay_p95_sec: number | null;
  last_verified_at: string | null;
  notes: string | null;
};

export type RegistrationUrlRow = {
  id: string;
  created_at: string;
  updated_at: string;
  domain: string;
  url: string;
  cms_type: string;
  score: number;
  status: RegistrationUrlStatus;
  verified: boolean;
  final_url: string | null;
  probe_at: string | null;
  failure_code: string | null;
  evidence: Record<string, unknown>;
};

export type RegistrationJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  domain: string;
  target_url: string;
  state: RegistrationJobState;
  pattern: string | null;
  attempt: number;
  submitted_at: string | null;
  next_poll_at: string | null;
  verify_link: string | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
};

export type RegistrationAccountRow = {
  id: string;
  created_at: string;
  updated_at: string;
  domain: string;
  register_url: string | null;
  login_url: string;
  account_email: string;
  username: string | null;
  password_value: string;
  status: RegistrationAccountStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type OwnedSiteDomainRow = {
  id: string;
  created_at: string;
  updated_at: string;
  domain: string;
  label: string | null;
  registration_notes: string | null;
  enabled: boolean;
};

export type RegistrationProbeResult = {
  ok: boolean;
  finalUrl: string;
  score: number;
  status: RegistrationUrlStatus;
  failureCode: string | null;
  evidence: {
    hasEmailField: boolean;
    hasPasswordField: boolean;
    hasSubmit: boolean;
    formCount: number;
    candidateLinks: string[];
    title: string | null;
  };
};
