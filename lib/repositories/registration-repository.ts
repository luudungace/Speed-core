import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { RegistrationJobRow, WorkerTaskPayload } from "@/lib/types/registration";

export class RegistrationRepository {
  private db = createSupabaseAdmin();

  // --- CANDIDATES (FROM CRAWLER RESULTS) ---

  async listCandidates(page = 1, pageSize = 20) {
    // 1. Get all URLs already enqueued/registered in registration_jobs
    const { data: jobUrlsData, error: jobUrlsError } = await this.db
      .from("registration_jobs")
      .select("url");
    if (jobUrlsError) throw jobUrlsError;

    const enqueuedUrls = (jobUrlsData ?? []).map((j) => j.url);

    // Lấy domains đã được enqueue để loại trùng theo domain (không chỉ URL)
    const enqueuedDomains = new Set(
      enqueuedUrls.map((u) => {
        try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
      })
    );

    // 2. Query candidates from crawl_results where CMS is known and crawl succeeded
    let query = this.db
      .from("crawl_results")
      .select("*", { count: "exact" })
      .eq("status", "success")
      .neq("cms_type", "Unknown");

    // Exclude enqueued URLs if any exist
    if (enqueuedUrls.length > 0) {
      query = query.not("url", "in", `(${enqueuedUrls.map((u) => `"${u}"`).join(",")})`);
    }

    // Lấy nhiều hơn để sau khi dedup domain vẫn đủ số lượng
    const fetchSize = pageSize * 5;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(0, fetchSize - 1);

    if (error) throw error;

    // 3. Dedup theo domain: chỉ giữ 1 URL đại diện mỗi domain
    const seenDomains = new Set<string>(enqueuedDomains);
    const deduped: typeof data = [];
    for (const row of data ?? []) {
      try {
        const domain = new URL(row.url).hostname.replace(/^www\./, "");
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);
        deduped.push(row);
      } catch {
        deduped.push(row); // URL không parse được → vẫn giữ
      }
    }

    // 4. Phân trang thủ công sau khi dedup
    const from = (page - 1) * pageSize;
    const pageRows = deduped.slice(from, from + pageSize);

    return { rows: pageRows ?? [], count: count ?? 0 };
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

    const inserts = (results ?? []).map((r) => ({
      url: r.url,
      cms_type: r.cms_type,
      status: "queued",
    }));

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
  }) {
    const { data, error } = await this.db
      .from("registration_jobs")
      .upsert({
        url: input.url,
        cms_type: input.cmsType,
        username: input.username || null,
        password: input.password || null,
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
    return { rows: (data ?? []) as RegistrationJobRow[], count: count ?? 0 };
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
    // If successful, email is marked as 'used' (or returned to 'available' for future, but standard registration pool marks it 'used' or 'available').
    // In our schema check: status is check in ('available', 'locked', 'used').
    // Let's set it to 'used' if successful, or release it as 'available' if failed.
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
        // Release proxy back to 'available' or mark as 'dead' if proxy failed.
        // Let's release it to 'available'.
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
}
