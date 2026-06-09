import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  OwnedSiteDomainRow,
  RegistrationAccountRow,
  RegistrationJobRow,
  RegistrationProbeResult,
  RegistrationUrlRow,
  SiteProfileRow,
} from "@/lib/types/registration";

export class RegistrationRepository {
  private db = createSupabaseAdmin();

  async upsertCandidate(input: {
    domain: string;
    url: string;
    cmsType: string;
    score: number;
    status?: RegistrationUrlRow["status"];
    evidence?: Record<string, unknown>;
  }) {
    const { data, error } = await this.db
      .from("registration_urls")
      .upsert(
        {
          domain: input.domain,
          url: input.url,
          cms_type: input.cmsType,
          score: input.score,
          status: input.status ?? "candidate",
          evidence: input.evidence ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "url" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return data as RegistrationUrlRow;
  }

  async upsertCandidates(
    inputs: Array<{
      domain: string;
      url: string;
      cmsType: string;
      score: number;
      status?: RegistrationUrlRow["status"];
      evidence?: Record<string, unknown>;
    }>,
  ) {
    if (inputs.length === 0) return [];

    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from("registration_urls")
      .upsert(
        inputs.map((input) => ({
          domain: input.domain,
          url: input.url,
          cms_type: input.cmsType,
          score: input.score,
          status: input.status ?? "candidate",
          evidence: input.evidence ?? {},
          updated_at: now,
        })),
        { onConflict: "url" },
      )
      .select("*");

    if (error) throw error;
    return (data ?? []) as RegistrationUrlRow[];
  }

  async deleteAllUrls() {
    const { error } = await this.db
      .from("registration_urls")
      .delete()
      .not("id", "is", null);
    if (error) throw error;
  }

  async deleteAllAccounts() {
    const { error } = await this.db
      .from("registration_accounts")
      .delete()
      .not("id", "is", null);
    if (error) throw error;
  }

  async recordProbe(input: {
    domain: string;
    url: string;
    cmsType: string;
    probe: RegistrationProbeResult;
  }) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from("registration_urls")
      .upsert(
        {
          domain: input.domain,
          url: input.url,
          cms_type: input.cmsType,
          score: input.probe.score,
          status: input.probe.status,
          verified: input.probe.ok,
          final_url: input.probe.finalUrl,
          probe_at: now,
          failure_code: input.probe.failureCode,
          evidence: input.probe.evidence,
          updated_at: now,
        },
        { onConflict: "url" },
      )
      .select("*")
      .single();

    if (error) throw error;

    if (input.probe.ok) {
      await this.upsertSiteProfile({
        domain: input.domain,
        registerUrl: input.probe.finalUrl,
        cmsType: input.cmsType,
        lastVerifiedAt: now,
      });
    }

    return data as RegistrationUrlRow;
  }

  async upsertSiteProfile(input: {
    domain: string;
    registerUrl: string;
    cmsType: string;
    lastVerifiedAt?: string;
  }) {
    const { data, error } = await this.db
      .from("site_profiles")
      .upsert(
        {
          domain: input.domain,
          register_url: input.registerUrl,
          cms_type: input.cmsType,
          last_verified_at: input.lastVerifiedAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return data as SiteProfileRow;
  }

  async listUrls(limit = 100) {
    const { data, error } = await this.db
      .from("registration_urls")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RegistrationUrlRow[];
  }

  async hideUrl(input: { domain: string; url: string; cmsType?: string }) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from("registration_urls")
      .upsert(
        {
          domain: input.domain,
          url: input.url,
          cms_type: input.cmsType ?? "Unknown",
          score: 0,
          status: "blocked",
          verified: false,
          failure_code: "hidden_by_user",
          evidence: {
            reason: "Hidden from registration candidates by user",
          },
          updated_at: now,
        },
        { onConflict: "url" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as RegistrationUrlRow;
  }

  async listJobs(limit = 50) {
    const { data, error } = await this.db
      .from("registration_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RegistrationJobRow[];
  }

  async createReviewJob(input: { domain: string; targetUrl: string; state?: RegistrationJobRow["state"]; metadata?: Record<string, unknown> }) {
    const { data, error } = await this.db
      .from("registration_jobs")
      .insert({
        domain: input.domain,
        target_url: input.targetUrl,
        state: input.state ?? "manual_review",
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as RegistrationJobRow;
  }

  async listAccounts(limit = 100) {
    const { data, error } = await this.db
      .from("registration_accounts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RegistrationAccountRow[];
  }

  async createAccount(input: {
    domain: string;
    registerUrl?: string | null;
    loginUrl: string;
    accountEmail: string;
    username?: string | null;
    passwordValue: string;
    status?: RegistrationAccountRow["status"];
    notes?: string | null;
  }) {
    const { data, error } = await this.db
      .from("registration_accounts")
      .insert({
        domain: input.domain,
        register_url: input.registerUrl ?? null,
        login_url: input.loginUrl,
        account_email: input.accountEmail,
        username: input.username ?? null,
        password_value: input.passwordValue,
        status: input.status ?? "manual_saved",
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as RegistrationAccountRow;
  }

  async listOwnedDomains(limit = 200) {
    const { data, error } = await this.db
      .from("owned_site_domains")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as OwnedSiteDomainRow[];
  }

  async upsertOwnedDomain(input: { domain: string; label?: string | null; notes?: string | null; enabled?: boolean }) {
    const { data, error } = await this.db
      .from("owned_site_domains")
      .upsert(
        {
          domain: input.domain,
          label: input.label ?? null,
          registration_notes: input.notes ?? null,
          enabled: input.enabled ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as OwnedSiteDomainRow;
  }

  async isOwnedDomain(domain: string) {
    const { data, error } = await this.db
      .from("owned_site_domains")
      .select("id")
      .eq("domain", domain)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
}
