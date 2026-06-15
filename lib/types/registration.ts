export interface RegistrationJobRow {
  id: string;
  created_at: string;
  updated_at: string;
  url: string;
  cms_type: string;
  status: "queued" | "processing" | "success" | "failed" | "cancelled";
  username: string | null;
  password: string | null;
  email_used: string | null;
  proxy_used: string | null;
  persona_used: string | null;
  error: string | null;
}

export interface WorkerTaskPayload {
  jobId: string;
  url: string;
  cmsType: string;
  username?: string | null;
  password?: string | null;
  email: {
    email: string;
    password: string;
    imapHost: string;
    imapPort: number;
  };
  proxy: {
    host: string;
    port: number;
    username: string | null;
    password: string | null;
    type: string;
  } | null;
  persona: {
    displayName: string;
    usernameBase: string;
    bio: string | null;
    gender: string | null;
    country: string | null;
  };
}
