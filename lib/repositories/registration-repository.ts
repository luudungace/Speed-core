import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { RegistrationJobRow, WorkerTaskPayload } from "@/lib/types/registration";

export class RegistrationRepository {
  private db = createSupabaseAdmin();

  // --- CANDIDATES (FROM CRAWLER RESULTS) ---

  async listCandidates(page = 1, pageSize = 20) {
    // 1. Fetch all registration jobs to match by domain/URL
    const { data: jobsData, error: jobsError } = await this.db
      .from("registration_jobs")
      .select("id, url, username, password, status, error");
    
    const jobsMap = new Map<string, { id: string, username: string | null, password: string | null, status: string, error: string | null }>();
    const domainJobsMap = new Map<string, { id: string, username: string | null, password: string | null, status: string, error: string | null }>();
    
    if (!jobsError && jobsData) {
      for (const j of jobsData) {
        jobsMap.set(j.url, {
          id: j.id,
          username: j.username,
          password: j.password,
          status: j.status,
          error: j.error
        });
        const dom = this.getDomain(j.url);
        if (j.username && j.password) {
          domainJobsMap.set(dom, {
            id: j.id,
            username: j.username,
            password: j.password,
            status: j.status,
            error: j.error
          });
        }
      }
    }

    // 2. Fetch candidates from crawl_results (fetch larger batch to dedup in memory)
    const fetchSize = pageSize * 10;
    const { data: crawlData, error: crawlError } = await this.db
      .from("crawl_results")
      .select("*")
      .eq("status", "success")
      .neq("cms_type", "Unknown")
      .order("created_at", { ascending: false })
      .range(0, fetchSize - 1);

    if (crawlError) throw crawlError;

    // 3. Dedup by domain
    const seenDomains = new Set<string>();
    const deduped: typeof crawlData = [];
    for (const row of crawlData ?? []) {
      const dom = this.getDomain(row.url);
      if (seenDomains.has(dom)) continue;
      seenDomains.add(dom);
      deduped.push(row);
    }

    // 4. Paginate
    const from = (page - 1) * pageSize;
    const pageRows = deduped.slice(from, from + pageSize);

    // 5. Map candidates with registration jobs status
    const rows = pageRows.map((row) => {
      const dom = this.getDomain(row.url);
      const job = jobsMap.get(row.url) || domainJobsMap.get(dom);
      const isRegistered = !!(job && job.username && job.password);
      return {
        ...row,
        registered: isRegistered,
        jobId: job ? job.id : null,
        username: job ? job.username : null,
        password: job ? job.password : null,
        jobStatus: job ? job.status : null,
        jobError: job ? job.error : null,
      };
    });

    return { rows, count: deduped.length };
  }


  private getDomain(urlStr: string): string {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, "");
    } catch {
      return urlStr;
    }
  }

  // --- ENQUEUE JOBS ---

  async enqueueJobs(urls: string[]) {
    if (urls.length === 0) return 0;

    // 1. Fetch CMS types for these candidate URLs
    const { data: results, error: resultsError } = await this.db
      .from("crawl_results")
      .select("url, cms_type")
      .in("url", urls);
    if (resultsError) throw resultsError;

    // 2. Fetch existing accounts to check for domain reuse
    const { data: existingJobs, error: existingError } = await this.db
      .from("registration_jobs")
      .select("url, username, password")
      .not("username", "is", null)
      .not("password", "is", null);
    
    const domainCredsMap = new Map<string, { username: string, password: string }>();
    if (!existingError && existingJobs) {
      for (const ej of existingJobs) {
        if (ej.username && ej.password) {
          const dom = this.getDomain(ej.url);
          domainCredsMap.set(dom, { username: ej.username, password: ej.password });
        }
      }
    }

    const inserts = (results ?? []).map((r) => {
      const dom = this.getDomain(r.url);
      const existing = domainCredsMap.get(dom);
      return {
        url: r.url,
        cms_type: r.cms_type,
        status: "queued",
        username: existing ? existing.username : null,
        password: existing ? existing.password : null,
      };
    });

    if (inserts.length === 0) return 0;

    const { error } = await this.db.from("registration_jobs").upsert(inserts, { onConflict: "url" });
    if (error) throw error;

    return inserts.length;
  }

  async addDirectJob(input: {
    url: string;
    cmsType: string;
    username?: string;
    password?: string;
    emailUsed?: string;
  }) {
    let username = input.username || null;
    let password = input.password || null;
    let emailUsed = input.emailUsed || null;

    if (!username || !password) {
      const dom = this.getDomain(input.url);
      const { data: existingJobs } = await this.db
        .from("registration_jobs")
        .select("url, username, password, email_used")
        .not("username", "is", null)
        .not("password", "is", null);
      
      if (existingJobs) {
        const matched = existingJobs.find(j => this.getDomain(j.url) === dom);
        if (matched) {
          username = matched.username;
          password = matched.password;
          if (!emailUsed) emailUsed = matched.email_used;
        }
      }
    }

    const { data, error } = await this.db
      .from("registration_jobs")
      .upsert({
        url: input.url,
        cms_type: input.cmsType,
        username,
        password,
        email_used: emailUsed,
        status: "queued",
      }, { onConflict: "url" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  // --- LIST QUEUED/ACTIVE JOBS ---

  async listJobs(page = 1, pageSize = 20, status?: string, isDirect?: boolean, hasAccount?: boolean) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    let query = this.db
      .from("registration_jobs")
      .select("*", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    if (hasAccount) {
      query = query.not("username", "is", null);
    }

    if (isDirect !== undefined) {
      if (isDirect) {
        query = query.not("username", "is", null).not("password", "is", null);
      } else {
        query = query.or("username.is.null,password.is.null");
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Fetch total registered vs unregistered counts for the dashboard
    const { count: unregisteredCount } = await this.db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true })
      .or("username.is.null,password.is.null");

    const { count: registeredCount } = await this.db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true })
      .not("username", "is", null)
      .not("password", "is", null);

    return {
      rows: (data ?? []) as RegistrationJobRow[],
      count: count ?? 0,
      unregisteredCount: unregisteredCount ?? 0,
      registeredCount: registeredCount ?? 0
    };
  }

  async deleteJob(id: string) {
    const { error } = await this.db
      .from("registration_jobs")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  }

  async requeueJob(id: string) {
    const { error } = await this.db
      .from("registration_jobs")
      .update({
        status: "queued",
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) throw error;
    return true;
  }

  // --- WORKER INTERACTION: PULL & LOCK ---

  async pullNextJobForWorker(isDirect: boolean | null = null): Promise<WorkerTaskPayload | null> {
    // 1. Find the next queued job (FIFO)
    let query = this.db
      .from("registration_jobs")
      .select("*")
      .eq("status", "queued");

    if (isDirect === true) {
      query = query.not("username", "is", null).not("password", "is", null);
    } else if (isDirect === false) {
      query = query.is("username", null).is("password", null);
    }

    const { data: job, error: jobError } = await query
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return null;

    // 2. Find an available Email resource (only if not a direct login job)
    let isDirectLogin = !!(job.username && job.password);
    let username = job.username;
    let password = job.password;
    let emailUsed = job.email_used;

    if (!isDirectLogin) {
      try {
        const urlObj = new URL(job.url);
        const domain = urlObj.hostname.replace("www.", "");
        
        // Find if we already registered on this domain
        let { data: existingJob } = await this.db
          .from("registration_jobs")
          .select("username, password, email_used")
          .eq("status", "success")
          .not("username", "is", null)
          .not("password", "is", null)
          .like("url", `%${domain}%`)
          .limit(1)
          .maybeSingle();

        if (!existingJob) {
          // If no successful job, try to reuse any job with credentials on this domain
          const { data: fallbackJob } = await this.db
            .from("registration_jobs")
            .select("username, password, email_used")
            .not("username", "is", null)
            .not("password", "is", null)
            .like("url", `%${domain}%`)
            .limit(1)
            .maybeSingle();
          existingJob = fallbackJob;
        }
          
        if (existingJob && existingJob.username && existingJob.password) {
          isDirectLogin = true;
          username = existingJob.username;
          password = existingJob.password;
          emailUsed = existingJob.email_used;
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }

    let email: any = null;

    if (!isDirectLogin) {
      const { data: emailData, error: emailError } = await this.db
        .from("emails")
        .select("*")
        .eq("status", "available")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (emailError) throw emailError;
      if (!emailData) {
        throw new Error("Không có email khả dụng nào trong kho tài nguyên để thực hiện đăng ký.");
      }
      email = emailData;
    } else {
      const { data: emailData } = await this.db
        .from("emails")
        .select("*")
        .eq("email", emailUsed || "")
        .maybeSingle();

      email = emailData || {
        email: emailUsed || "dummy@example.com",
        password: "dummy",
        imap_host: "imap.example.com",
        imap_port: 993,
      };
    }

    // 3. Find an available Proxy (optional)
    const { data: proxy, error: proxyError } = await this.db
      .from("proxies")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (proxyError) throw proxyError;

    // 4. Find an available Persona
    const { data: persona, error: personaError } = await this.db
      .from("personas")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (personaError) throw personaError;
    if (!persona) {
      throw new Error("Không có Persona (hồ sơ ảo) khả dụng nào trong kho tài nguyên để thực hiện đăng ký.");
    }

    const now = new Date().toISOString();

    // 5. Lock Resources & Update Job status
    const updatePayload: any = {
      status: "processing",
      persona_used: persona.id,
      updated_at: now,
    };
    if (isDirectLogin) {
      updatePayload.username = username;
      updatePayload.password = password;
      updatePayload.email_used = emailUsed;
    }

    const { error: lockJobError } = await this.db
      .from("registration_jobs")
      .update(updatePayload)
      .eq("id", job.id);
    if (lockJobError) throw lockJobError;

    if (!isDirectLogin && email && email.id) {
      const { error: lockEmailError } = await this.db
        .from("emails")
        .update({ status: "locked", locked_at: now, updated_at: now })
        .eq("id", email.id);
      if (lockEmailError) throw lockEmailError;
    }

    if (proxy) {
      const { error: lockProxyError } = await this.db
        .from("proxies")
        .update({ status: "locked", locked_at: now, updated_at: now })
        .eq("id", proxy.id);
      if (lockProxyError) throw lockProxyError;
    }

    return {
      jobId: job.id,
      url: job.url,
      cmsType: job.cms_type,
      username: username,
      password: password,
      email: {
        email: email.email,
        password: email.password,
        imapHost: email.imap_host,
        imapPort: email.imap_port,
      },
      proxy: proxy
        ? {
            host: proxy.host,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            type: proxy.type,
          }
        : null,
      persona: {
        displayName: persona.display_name,
        usernameBase: persona.username_base,
        bio: persona.bio,
        gender: persona.gender,
        country: persona.country,
      },
    };
  }

  // --- WORKER INTERACTION: REPORT RESULTS ---

  async reportJobResult(
    jobId: string,
    result: {
      status: "success" | "failed";
      username?: string;
      password?: string;
      emailUsed: string;
      proxyUsed?: string;
      error?: string;
    }
  ) {
    const now = new Date().toISOString();

    // 1. Get the registration job info
    const { data: job, error: jobQueryError } = await this.db
      .from("registration_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobQueryError) throw jobQueryError;

    // 2. Update registration_jobs table
    const updateData: any = {
      status: result.status,
      email_used: result.emailUsed,
      proxy_used: result.proxyUsed || null,
      error: result.error || null,
      updated_at: now,
    };

    if (result.username !== undefined) {
      updateData.username = result.username;
    }
    if (result.password !== undefined) {
      updateData.password = result.password;
    }

    const { error: updateJobError } = await this.db
      .from("registration_jobs")
      .update(updateData)
      .eq("id", jobId);
    if (updateJobError) throw updateJobError;

    // 2b. Cleanup domain credentials if banned
    if (result.error && (
      result.error.toLowerCase().includes("banned") ||
      result.error.toLowerCase().includes("gesperrt") ||
      result.error.toLowerCase().includes("suspended") ||
      result.error.toLowerCase().includes("locked")
    )) {
      try {
        const urlObj = new URL(job.url);
        const domain = urlObj.hostname.replace("www.", "");
        
        await this.db
          .from("registration_jobs")
          .update({
            username: null,
            password: null,
            email_used: null,
            status: "failed",
            error: "Tài khoản bị ban/gesperrt. Đã xóa credentials để tự động đăng ký lại."
          })
          .like("url", `%${domain}%`);
          
        console.log(`[Domain Cleanup] Banned account detected on ${domain}. Cleared credentials for all jobs on this domain.`);
      } catch (e) {
        // Ignore URL parsing errors
      }
    }

    // 3. Update Email Resource status
    const emailStatus = result.status === "success" ? "used" : "available";
    const { error: updateEmailError } = await this.db
      .from("emails")
      .update({ status: emailStatus, locked_at: null, updated_at: now })
      .eq("email", result.emailUsed);
    if (updateEmailError) throw updateEmailError;

    // 4. Update Proxy Resource status (if one was used)
    if (result.proxyUsed) {
      const proxyParts = result.proxyUsed.split(":");
      const host = proxyParts[0];
      const port = parseInt(proxyParts[1], 10);

      if (host && !isNaN(port)) {
        const proxyStatus = result.status === "failed" && result.error?.toLowerCase().includes("proxy") ? "dead" : "available";
        const { error: updateProxyError } = await this.db
          .from("proxies")
          .update({ status: proxyStatus, locked_at: null, updated_at: now })
          .eq("host", host)
          .eq("port", port);
        if (updateProxyError) throw updateProxyError;
      }
    }
  }

  async getJobById(id: string) {
    const { data, error } = await this.db
      .from("registration_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return { data, error };
  }

  async updateJobError(id: string, error: string | null) {
    const { error: err } = await this.db
      .from("registration_jobs")
      .update({ error, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) throw err;
    return true;
  }

  async saveCredentials(id: string, username: string, password: string) {
    const { error } = await this.db
      .from("registration_jobs")
      .update({
        username,
        password,
        status: "queued",
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) throw error;
    return true;
  }
}
