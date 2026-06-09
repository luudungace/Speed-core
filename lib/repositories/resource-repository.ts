import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { EmailRow, ProxyRow, PersonaRow } from "@/lib/types/resources";

export class ResourceRepository {
  private db = createSupabaseAdmin();

  // --- EMAILS ---

  async listEmails(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await this.db
      .from("emails")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { rows: (data ?? []) as EmailRow[], count: count ?? 0 };
  }

  async addEmailsBulk(bulkText: string, defaultImapHost = "imap.gmail.com", defaultImapPort = 993) {
    const lines = bulkText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const inserts = [];

    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length >= 2) {
        const email = parts[0].trim();
        const password = parts[1].trim();
        if (email && password) {
          inserts.push({
            email,
            password,
            imap_host: defaultImapHost,
            imap_port: defaultImapPort,
            status: "available",
          });
        }
      }
    }

    if (inserts.length === 0) return 0;

    const { error } = await this.db.from("emails").upsert(inserts, { onConflict: "email" });
    if (error) throw error;

    return inserts.length;
  }

  async deleteEmails(ids: string[]) {
    const { error } = await this.db.from("emails").delete().in("id", ids);
    if (error) throw error;
  }

  async unlockEmails(ids: string[]) {
    const { error } = await this.db
      .from("emails")
      .update({ status: "available", locked_at: null, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
  }

  // --- PROXIES ---

  async listProxies(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await this.db
      .from("proxies")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { rows: (data ?? []) as ProxyRow[], count: count ?? 0 };
  }

  async addProxiesBulk(bulkText: string, type: "Residential" | "Datacenter" = "Residential") {
    const lines = bulkText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const inserts = [];

    for (const line of lines) {
      // Formats: host:port OR host:port:user:pass
      const parts = line.split(":");
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim(), 10);
        const username = parts[2]?.trim() || null;
        const password = parts[3]?.trim() || null;

        if (host && !isNaN(port)) {
          inserts.push({
            host,
            port,
            username,
            password,
            type,
            status: "available",
          });
        }
      }
    }

    if (inserts.length === 0) return 0;

    const { error } = await this.db.from("proxies").upsert(inserts, { onConflict: "host,port" });
    if (error) throw error;

    return inserts.length;
  }

  async deleteProxies(ids: string[]) {
    const { error } = await this.db.from("proxies").delete().in("id", ids);
    if (error) throw error;
  }

  // --- PERSONAS ---

  async listPersonas(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await this.db
      .from("personas")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { rows: (data ?? []) as PersonaRow[], count: count ?? 0 };
  }

  async addPersona(input: {
    displayName: string;
    usernameBase: string;
    bio: string | null;
    gender: string | null;
    country: string | null;
  }) {
    const { data, error } = await this.db
      .from("personas")
      .insert({
        display_name: input.displayName,
        username_base: input.usernameBase,
        bio: input.bio,
        gender: input.gender,
        country: input.country,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as PersonaRow;
  }

  async deletePersonas(ids: string[]) {
    const { error } = await this.db.from("personas").delete().in("id", ids);
    if (error) throw error;
  }
}
