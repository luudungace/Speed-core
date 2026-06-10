"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Upload, Unlock, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";

const tabs = ["Email Pool", "Proxy", "Persona"] as const;
type ResourceTab = (typeof tabs)[number];
type PoolStatus = "available" | "locked" | "invalid" | "disabled" | "used";

type EmailPoolRow = {
  id: string;
  email: string;
  password_value: string;
  imap_host: string;
  imap_port: number;
  status: PoolStatus;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type ProxyPoolRow = {
  id: string;
  endpoint: string;
  proxy_type: string;
  host: string;
  port: number;
  username: string | null;
  status: PoolStatus;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type PersonaPoolRow = {
  id: string;
  display_name: string;
  username_base: string;
  bio: string | null;
  gender: string | null;
  country: string | null;
  status: PoolStatus;
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type ResourceResponse<T> = {
  rows: T[];
  count: number;
  error?: string;
  saved?: number;
  deleted?: number;
  unlocked?: number;
};

function toMessage(value: unknown, fallback = "Co loi xay ra.") {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = [record.message, record.error, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(record);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

export default function ResourcesPage() {
  const [tab, setTab] = useState<ResourceTab>("Email Pool");
  const [bulkEmails, setBulkEmails] = useState("user@gmail.com|app-password\nuser2@gmail.com|app-password");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [emails, setEmails] = useState<EmailPoolRow[]>([]);
  const [bulkProxies, setBulkProxies] = useState("1.2.3.4:8080:user:pass");
  const [proxyType, setProxyType] = useState("residential");
  const [proxies, setProxies] = useState<ProxyPoolRow[]>([]);
  const [personaDisplayName, setPersonaDisplayName] = useState("Anna Nguyen");
  const [personaUsernameBase, setPersonaUsernameBase] = useState("anna.nguyen");
  const [personaBio, setPersonaBio] = useState("");
  const [personaGender, setPersonaGender] = useState("");
  const [personaCountry, setPersonaCountry] = useState("");
  const [personas, setPersonas] = useState<PersonaPoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlockingEmails, setUnlockingEmails] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleCount = useMemo(() => {
    if (tab === "Email Pool") return emails.length;
    if (tab === "Proxy") return proxies.length;
    return personas.length;
  }, [emails.length, personas.length, proxies.length, tab]);

  async function fetchRows<T>(url: string) {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    let data: ResourceResponse<T>;
    try {
      data = JSON.parse(text) as ResourceResponse<T>;
    } catch {
      const snippet = text.replace(/\s+/g, " ").slice(0, 120);
      throw new Error(`API ${url} khong tra ve JSON hop le: ${snippet || response.statusText}`);
    }
    if (!response.ok) throw new Error(data.error ?? "Khong tai duoc du lieu.");
    return data.rows;
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      fetchRows<EmailPoolRow>("/api/resources/emails"),
      fetchRows<ProxyPoolRow>("/api/resources/proxies"),
      fetchRows<PersonaPoolRow>("/api/resources/personas"),
    ]);

    const errors: string[] = [];
    if (results[0].status === "fulfilled") setEmails(results[0].value);
    else errors.push(results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason));

    if (results[1].status === "fulfilled") setProxies(results[1].value);
    else errors.push(results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason));

    if (results[2].status === "fulfilled") setPersonas(results[2].value);
    else errors.push(results[2].reason instanceof Error ? results[2].reason.message : String(results[2].reason));

    if (errors.length > 0) {
      setError(errors.join(" "));
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function saveEmails() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: bulkEmails, imapHost, imapPort: Number(imapPort) }),
      });
      const data = (await response.json()) as ResourceResponse<EmailPoolRow>;
      if (!response.ok) throw new Error(data.error ?? "Khong nap duoc email.");
      setEmails(data.rows);
      setMessage(`Da nap ${data.saved ?? 0} email vao pool.`);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveProxies() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: bulkProxies, proxyType }),
      });
      const data = (await response.json()) as ResourceResponse<ProxyPoolRow>;
      if (!response.ok) throw new Error(data.error ?? "Khong nap duoc proxy.");
      setProxies(data.rows);
      setMessage(`Da nap ${data.saved ?? 0} proxy vao pool.`);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePersona() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: personaDisplayName,
          usernameBase: personaUsernameBase,
          bio: personaBio,
          gender: personaGender,
          country: personaCountry,
        }),
      });
      const data = (await response.json()) as ResourceResponse<PersonaPoolRow>;
      if (!response.ok) throw new Error(data.error ?? "Khong luu duoc persona.");
      setPersonas(data.rows);
      setMessage("Da luu persona.");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function unlockEmails() {
    setUnlockingEmails(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_stuck" }),
      });
      const data = (await response.json()) as ResourceResponse<EmailPoolRow>;
      if (!response.ok) throw new Error(data.error ?? "Khong mo khoa duoc email.");
      setEmails(data.rows);
      setMessage(`Da mo khoa ${data.unlocked ?? 0} email bi ket.`);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setUnlockingEmails(false);
    }
  }

  async function deleteResource(kind: ResourceTab, id: string) {
    setDeletingId(id);
    setMessage("");
    setError("");
    try {
      const url =
        kind === "Email Pool" ? "/api/resources/emails" : kind === "Proxy" ? "/api/resources/proxies" : "/api/resources/personas";
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as ResourceResponse<EmailPoolRow | ProxyPoolRow | PersonaPoolRow>;
      if (!response.ok) throw new Error(data.error ?? "Khong xoa duoc tai nguyen.");
      if (kind === "Email Pool") setEmails(data.rows as EmailPoolRow[]);
      if (kind === "Proxy") setProxies(data.rows as ProxyPoolRow[]);
      if (kind === "Persona") setPersonas(data.rows as PersonaPoolRow[]);
      setMessage("Da xoa tai nguyen.");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell title="Tai nguyen">
      <h1 className="text-2xl font-semibold tracking-normal">Quan ly tai nguyen</h1>
      <p className="mt-1 text-sm text-muted">Auto-register dung Email Pool, Proxy va Persona. User Pool da duoc bo khoi luong dang ky.</p>

      <div className="mt-7 inline-flex rounded-md bg-[#162130] p-1">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-[#070c14] text-white" : "text-muted"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[512px_1fr]">
        <Panel>
          {tab === "Email Pool" && (
            <>
              <h2 className="text-base font-semibold">Nap email bulk</h2>
              <p className="text-sm text-muted">Moi dong: email|password</p>
              <Textarea className="mt-7 h-44 w-full" value={bulkEmails} onChange={(event) => setBulkEmails(event.target.value)} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold">IMAP host</label>
                  <Input value={imapHost} onChange={(event) => setImapHost(event.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Port</label>
                  <Input value={imapPort} onChange={(event) => setImapPort(event.target.value)} className="w-full" inputMode="numeric" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={saveEmails} disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Nap
                </Button>
                <Button variant="ghost" onClick={unlockEmails} disabled={unlockingEmails}>
                  {unlockingEmails ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                  Mo khoa ket
                </Button>
              </div>
            </>
          )}

          {tab === "Proxy" && (
            <>
              <h2 className="text-base font-semibold">Nap proxy bulk</h2>
              <p className="font-mono text-sm text-muted">host:port hoac host:port:user:pass</p>
              <Textarea className="mt-7 h-44 w-full" value={bulkProxies} onChange={(event) => setBulkProxies(event.target.value)} />
              <label className="mb-1 mt-4 block text-sm font-semibold">Loai</label>
              <Select className="w-full" value={proxyType} onChange={(event) => setProxyType(event.target.value)}>
                <option value="residential">Residential</option>
                <option value="datacenter">Datacenter</option>
              </Select>
              <Button className="mt-3" onClick={saveProxies} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Nap proxy
              </Button>
            </>
          )}

          {tab === "Persona" && (
            <>
              <h2 className="text-base font-semibold">Them persona</h2>
              <p className="text-sm text-muted">Thong tin nay se duoc dung khi dang ky tu dong.</p>
              <div className="mt-7 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Display name</label>
                  <Input className="w-full" value={personaDisplayName} onChange={(event) => setPersonaDisplayName(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Username base</label>
                  <Input className="w-full" value={personaUsernameBase} onChange={(event) => setPersonaUsernameBase(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Bio</label>
                  <Textarea className="h-20 w-full" value={personaBio} onChange={(event) => setPersonaBio(event.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Gender</label>
                    <Input className="w-full" value={personaGender} onChange={(event) => setPersonaGender(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Country</label>
                    <Input className="w-full" value={personaCountry} onChange={(event) => setPersonaCountry(event.target.value)} />
                  </div>
                </div>
                <Button onClick={savePersona} disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Them persona
                </Button>
              </div>
            </>
          )}

          {message && <p className="mt-3 text-sm text-primary">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {tab === "Email Pool" ? "Email pool" : tab === "Proxy" ? "Proxy pool" : "Personas"} ({visibleCount})
            </h2>
            {tab === "Email Pool" && (
              <Button className="h-8 px-2 text-xs" variant="ghost" onClick={() => setShowPasswords((value) => !value)}>
                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPasswords ? "An mat khau" : "Hien mat khau"}
              </Button>
            )}
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_40px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
              <span>{tab === "Email Pool" ? "Email" : tab === "Proxy" ? "Endpoint" : "Name"}</span>
              <span>{tab === "Email Pool" ? "Password" : tab === "Proxy" ? "Type" : "Username"}</span>
              <span>{tab === "Email Pool" ? "IMAP" : tab === "Proxy" ? "Auth" : "Country"}</span>
              <span>Status</span>
              <span></span>
            </div>

            {loading && <div className="grid h-20 place-items-center text-sm text-muted">Dang tai...</div>}
            {!loading && tab === "Email Pool" && emails.length === 0 && <div className="grid h-20 place-items-center text-sm text-muted">Chua co email.</div>}
            {!loading && tab === "Proxy" && proxies.length === 0 && <div className="grid h-20 place-items-center text-sm text-muted">Chua co proxy.</div>}
            {!loading && tab === "Persona" && personas.length === 0 && <div className="grid h-20 place-items-center text-sm text-muted">Chua co persona.</div>}

            {!loading &&
              tab === "Email Pool" &&
              emails.map((row) => (
                <ResourceRow
                  key={row.id}
                  id={row.id}
                  kind={tab}
                  first={row.email}
                  second={showPasswords ? row.password_value : "********"}
                  third={`${row.imap_host}:${row.imap_port}`}
                  status={row.status}
                  deletingId={deletingId}
                  onDelete={deleteResource}
                />
              ))}

            {!loading &&
              tab === "Proxy" &&
              proxies.map((row) => (
                <ResourceRow
                  key={row.id}
                  id={row.id}
                  kind={tab}
                  first={row.endpoint}
                  second={row.proxy_type}
                  third={row.username ? "Co auth" : "Khong auth"}
                  status={row.status}
                  deletingId={deletingId}
                  onDelete={deleteResource}
                />
              ))}

            {!loading &&
              tab === "Persona" &&
              personas.map((row) => (
                <ResourceRow
                  key={row.id}
                  id={row.id}
                  kind={tab}
                  first={row.display_name}
                  second={row.username_base}
                  third={row.country ?? "-"}
                  status={row.status}
                  deletingId={deletingId}
                  onDelete={deleteResource}
                />
              ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function ResourceRow({
  id,
  kind,
  first,
  second,
  third,
  status,
  deletingId,
  onDelete,
}: {
  id: string;
  kind: ResourceTab;
  first: string;
  second: string;
  third: string;
  status: PoolStatus;
  deletingId: string | null;
  onDelete: (kind: ResourceTab, id: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_40px] items-center border-b border-border/60 px-3 py-3 text-sm last:border-b-0">
      <span className="truncate pr-3 font-mono">{first}</span>
      <span className="truncate pr-3 font-mono text-muted">{second}</span>
      <span className="truncate pr-3 text-muted">{third}</span>
      <span className="capitalize text-muted">{status.replace("_", " ")}</span>
      <button
        type="button"
        title="Xoa"
        aria-label={`Xoa ${first}`}
        onClick={() => void onDelete(kind, id)}
        disabled={deletingId === id}
        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:border-red-400/50 hover:bg-red-950/30 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deletingId === id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
      </button>
    </div>
  );
}
