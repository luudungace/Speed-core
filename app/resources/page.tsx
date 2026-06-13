"use client";

import { useEffect, useState } from "react";
import { Link2, Trash2, Upload, Unlock, Unplug } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";

const tabs = ["Email Pool", "Proxy", "Persona"] as const;
const EMAIL_STORAGE_KEY = "speed-core.email-pool";

type EmailResource = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  status: "ready" | "locked";
};

type GmailOAuthStatus = {
  configured: boolean;
  clientId: string;
  connectedEmails: Array<{ email: string; updatedAt: string; scope?: string }>;
};

function parseEmailRows(input: string, imapHost: string, imapPort: string) {
  const rows: EmailResource[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  input.split(/\r?\n/).forEach((line, index) => {
    const raw = line.trim();
    if (!raw) return;

    const parts = raw.split("|");
    const email = (parts[0] ?? "").replace(/\s+/g, "").toLowerCase();
    const password = parts.slice(1).join("|").trim();

    if (!email || !password) {
      errors.push(`Dòng ${index + 1}: thiếu email hoặc password.`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Dòng ${index + 1}: email không hợp lệ.`);
      return;
    }
    if (seen.has(email)) {
      errors.push(`Dòng ${index + 1}: email bị trùng trong danh sách nhập.`);
      return;
    }

    seen.add(email);
    rows.push({ email, password, imapHost: imapHost.trim(), imapPort: imapPort.trim(), status: "ready" });
  });

  return { rows, errors };
}

function mergeEmailPool(primary: EmailResource[], secondary: EmailResource[]) {
  const byEmail = new Map<string, EmailResource>();
  for (const item of [...secondary, ...primary]) {
    byEmail.set(item.email, { ...(byEmail.get(item.email) ?? item), ...item });
  }
  return [...byEmail.values()];
}

async function persistEmailPool(items: EmailResource[]) {
  await fetch("/api/resources/email-pool", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  }).catch(() => undefined);
}

export default function ResourcesPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Email Pool");
  const [emailBulk, setEmailBulk] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [emailPool, setEmailPool] = useState<EmailResource[]>([]);
  const [emailPoolLoaded, setEmailPoolLoaded] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [gmailOAuth, setGmailOAuth] = useState<GmailOAuthStatus>({ configured: false, clientId: "", connectedEmails: [] });
  const [gmailClientId, setGmailClientId] = useState("");
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [gmailMessage, setGmailMessage] = useState("");
  const [gmailError, setGmailError] = useState("");
  const [proxyBulk, setProxyBulk] = useState("");
  const [proxyType, setProxyType] = useState("Residential");
  const [displayName, setDisplayName] = useState("");
  const [usernameBase, setUsernameBase] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEmailPool() {
      try {
        const stored = window.localStorage.getItem(EMAIL_STORAGE_KEY);
        const localItems = stored ? (JSON.parse(stored) as EmailResource[]) : [];
        const response = await fetch("/api/resources/email-pool", { cache: "no-store" });
        const payload = (await response.json()) as { items?: EmailResource[] };
        const serverItems = payload.items ?? [];
        const merged = mergeEmailPool(serverItems, localItems);
        if (cancelled) return;
        setEmailPool(merged);
        setEmailPoolLoaded(true);
        window.localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(merged));
        if (localItems.length > 0 && merged.length >= serverItems.length) void persistEmailPool(merged);
      } catch {
        try {
          const stored = window.localStorage.getItem(EMAIL_STORAGE_KEY);
          const localItems = stored ? (JSON.parse(stored) as EmailResource[]) : [];
          if (!cancelled) setEmailPool(localItems);
        } catch {
          if (!cancelled) setEmailPool([]);
        } finally {
          if (!cancelled) setEmailPoolLoaded(true);
        }
      }
    }

    void loadEmailPool();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGmailOAuth() {
      try {
        const response = await fetch("/api/resources/gmail-oauth", { cache: "no-store" });
        const payload = (await response.json()) as GmailOAuthStatus;
        if (cancelled) return;
        setGmailOAuth(payload);
        setGmailClientId(payload.clientId ?? "");
        const params = new URLSearchParams(window.location.search);
        if (params.get("gmail_oauth") === "connected") {
          setGmailMessage(`Đã kết nối Gmail OAuth cho ${params.get("email") ?? "email"}.`);
          window.history.replaceState({}, "", window.location.pathname);
        }
        if (params.get("gmail_oauth") === "error") {
          setGmailError(params.get("message") ?? "Không kết nối được Gmail OAuth.");
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {
        if (!cancelled) setGmailError("Không tải được cấu hình Gmail OAuth.");
      }
    }

    void loadGmailOAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!emailPoolLoaded) return;
    window.localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(emailPool));
    void persistEmailPool(emailPool);
  }, [emailPool, emailPoolLoaded]);

  function importEmails() {
    const { rows, errors } = parseEmailRows(emailBulk, imapHost, imapPort);
    const existingEmails = new Set(emailPool.map((item) => item.email));
    const newRows = rows.filter((row) => !existingEmails.has(row.email));
    const duplicateCount = rows.length - newRows.length;

    setEmailError([...errors, duplicateCount > 0 ? `${duplicateCount} email đã có trong pool.` : ""].filter(Boolean).join(" "));

    if (newRows.length === 0) {
      setEmailMessage("");
      return;
    }

    setEmailPool((current) => mergeEmailPool(newRows, current));
    setEmailBulk("");
    setEmailMessage(`Đã nạp ${newRows.length} email vào pool.`);
  }

  function unlockEmails() {
    setEmailPool((current) => current.map((item) => ({ ...item, status: "ready" })));
    setEmailMessage("Đã mở khóa toàn bộ email trong pool.");
    setEmailError("");
  }

  function deleteEmail(email: string) {
    setEmailPool((current) => current.filter((item) => item.email !== email));
    setEmailMessage("Đã xóa email khỏi Email Pool. Email này sẽ không được dùng để đăng ký.");
    setEmailError("");
  }

  async function saveGmailOAuthConfig() {
    setGmailMessage("");
    setGmailError("");
    try {
      const response = await fetch("/api/resources/gmail-oauth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: gmailClientId, clientSecret: gmailClientSecret }),
      });
      const payload = (await response.json()) as { configured?: boolean; clientId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Không lưu được Gmail OAuth.");
      setGmailOAuth((current) => ({ ...current, configured: Boolean(payload.configured), clientId: payload.clientId ?? gmailClientId }));
      setGmailClientSecret("");
      setGmailMessage("Đã lưu Gmail OAuth client.");
    } catch (error) {
      setGmailError(error instanceof Error ? error.message : "Không lưu được Gmail OAuth.");
    }
  }

  async function connectGmailOAuth(email: string) {
    setGmailMessage("");
    setGmailError("");
    try {
      const response = await fetch("/api/resources/gmail-oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { authUrl?: string; error?: string };
      if (!response.ok || !payload.authUrl) throw new Error(payload.error || "Không tạo được Gmail OAuth URL.");
      window.location.href = payload.authUrl;
    } catch (error) {
      setGmailError(error instanceof Error ? error.message : "Không mở được Gmail OAuth.");
    }
  }

  async function disconnectGmailOAuth(email: string) {
    setGmailMessage("");
    setGmailError("");
    try {
      const response = await fetch(`/api/resources/gmail-oauth?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      const payload = (await response.json()) as { connectedEmails?: GmailOAuthStatus["connectedEmails"]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Không hủy được Gmail OAuth.");
      setGmailOAuth((current) => ({ ...current, connectedEmails: payload.connectedEmails ?? [] }));
      setGmailMessage(`Đã hủy kết nối Gmail OAuth cho ${email}.`);
    } catch (error) {
      setGmailError(error instanceof Error ? error.message : "Không hủy được Gmail OAuth.");
    }
  }

  const connectedGmailEmails = new Set(gmailOAuth.connectedEmails.map((item) => item.email));
  const gmailRedirectUri = typeof window === "undefined" ? "http://localhost:4000/auth/gmail/callback" : `${window.location.origin}/auth/gmail/callback`;

  return (
    <AppShell title="Tài nguyên">
      <h1 className="text-2xl font-semibold tracking-normal">Quản lý tài nguyên</h1>
      <p className="mt-1 text-sm text-muted">Kho dùng chung: Email, Proxy, Persona. Worker tự động khóa/mở khóa khi sử dụng.</p>

      <div className="mt-7 inline-flex rounded-md bg-[#162130] p-1">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
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
              <h2 className="text-base font-semibold">Nạp email (bulk)</h2>
              <p className="text-sm text-muted">Mỗi dòng: email|password</p>
              <Textarea
                aria-label="Danh sách email"
                className="mt-7 h-44 w-full"
                placeholder={"user@outlook.com|abc123\nuser2@gmail.com|xyz456"}
                spellCheck={false}
                value={emailBulk}
                onChange={(event) => {
                  setEmailBulk(event.target.value);
                  setEmailMessage("");
                  setEmailError("");
                }}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="imap-host" className="mb-1 block text-sm font-semibold">IMAP host</label>
                  <Input id="imap-host" value={imapHost} onChange={(event) => setImapHost(event.target.value)} className="w-full" />
                </div>
                <div>
                  <label htmlFor="imap-port" className="mb-1 block text-sm font-semibold">Port</label>
                  <Input id="imap-port" value={imapPort} onChange={(event) => setImapPort(event.target.value)} className="w-full" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" onClick={importEmails}><Upload size={16} />Nạp</Button>
                <Button type="button" variant="ghost" onClick={unlockEmails}><Unlock size={16} />Mở khóa kẹt</Button>
              </div>
              {emailMessage ? <p className="mt-3 text-sm text-primary">{emailMessage}</p> : null}
              {emailError ? <p className="mt-3 text-sm text-red-300">{emailError}</p> : null}

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Gmail API OAuth</h3>
                <p className="mt-1 text-xs text-muted">Redirect URI: <span className="font-mono text-white">{gmailRedirectUri}</span></p>
                <div className="mt-3 space-y-2">
                  <Input
                    aria-label="Google OAuth Client ID"
                    className="w-full"
                    placeholder="Google OAuth Client ID"
                    value={gmailClientId}
                    onChange={(event) => {
                      setGmailClientId(event.target.value);
                      setGmailMessage("");
                      setGmailError("");
                    }}
                  />
                  <Input
                    aria-label="Google OAuth Client Secret"
                    className="w-full"
                    placeholder={gmailOAuth.configured ? "Client secret đã lưu, nhập lại nếu muốn đổi" : "Google OAuth Client Secret"}
                    value={gmailClientSecret}
                    onChange={(event) => {
                      setGmailClientSecret(event.target.value);
                      setGmailMessage("");
                      setGmailError("");
                    }}
                  />
                </div>
                <Button type="button" className="mt-3" onClick={saveGmailOAuthConfig}>
                  <Link2 size={16} />
                  Lưu OAuth
                </Button>
                {gmailMessage ? <p className="mt-3 text-sm text-primary">{gmailMessage}</p> : null}
                {gmailError ? <p className="mt-3 text-sm text-red-300">{gmailError}</p> : null}
              </div>
            </>
          )}

          {tab === "Proxy" && (
            <>
              <h2 className="text-base font-semibold">Nạp proxy</h2>
              <p className="font-mono text-sm text-muted">host:port:user:pass</p>
              <Textarea
                aria-label="Danh sách proxy"
                className="mt-7 h-44 w-full"
                placeholder="1.2.3.4:8080:user:pass"
                spellCheck={false}
                value={proxyBulk}
                onChange={(event) => setProxyBulk(event.target.value)}
              />
              <label htmlFor="proxy-type" className="mb-1 mt-4 block text-sm font-semibold">Loại</label>
              <Select id="proxy-type" className="w-full" value={proxyType} onChange={(event) => setProxyType(event.target.value)}>
                <option>Residential</option>
                <option>Datacenter</option>
              </Select>
              <Button type="button" className="mt-3"><Upload size={16} />Nạp</Button>
            </>
          )}

          {tab === "Persona" && (
            <>
              <h2 className="text-base font-semibold">Thêm persona</h2>
              <p className="text-sm text-muted">Bộ hồ sơ ảo cho tool đóng giả người dùng.</p>
              <div className="mt-7 space-y-4">
                <div>
                  <label htmlFor="display-name" className="mb-1 block text-sm font-semibold">Display name</label>
                  <Input id="display-name" className="w-full" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="username-base" className="mb-1 block text-sm font-semibold">Username base</label>
                  <Input id="username-base" className="w-full" placeholder="johnny_smith" value={usernameBase} onChange={(event) => setUsernameBase(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="persona-bio" className="mb-1 block text-sm font-semibold">Bio</label>
                  <Textarea id="persona-bio" className="h-14 w-full" value={bio} onChange={(event) => setBio(event.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="persona-gender" className="mb-1 block text-sm font-semibold">Gender</label>
                    <Input id="persona-gender" className="w-full" value={gender} onChange={(event) => setGender(event.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="persona-country" className="mb-1 block text-sm font-semibold">Country</label>
                    <Input id="persona-country" className="w-full" value={country} onChange={(event) => setCountry(event.target.value)} />
                  </div>
                </div>
                <Button type="button">Thêm persona</Button>
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold">{tab === "Email Pool" ? `Email pool (${emailPool.length})` : tab === "Proxy" ? "Proxy pool (0)" : "Personas (0)"}</h2>
          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[minmax(0,1fr)_180px_120px_128px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
              <span>{tab === "Email Pool" ? "Email" : tab === "Proxy" ? "Endpoint" : "Name"}</span>
              <span>{tab === "Email Pool" ? "IMAP" : tab === "Proxy" ? "Type" : "Username"}</span>
              <span>Status</span>
              <span>{tab === "Email Pool" ? "Action" : ""}</span>
            </div>
            {tab === "Email Pool" && emailPool.length > 0 ? (
              <div className="max-h-[420px] divide-y divide-border overflow-auto">
                {emailPool.map((item) => (
                  <div key={item.email} className="grid grid-cols-[minmax(0,1fr)_180px_120px_128px] items-center gap-3 px-3 py-3 text-sm">
                    <span className="truncate font-medium text-white" title={item.email}>{item.email}</span>
                    <span className="truncate text-muted" title={`${item.imapHost}:${item.imapPort}`}>{item.imapHost}:{item.imapPort}</span>
                    <span className={item.status === "ready" ? "text-primary" : "text-yellow-300"}>{item.status === "ready" ? "Sẵn sàng" : "Đang khóa"}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-primary hover:bg-[#111b29] disabled:cursor-not-allowed disabled:opacity-50"
                        title={connectedGmailEmails.has(item.email) ? "Kết nối lại Gmail OAuth" : "Kết nối Gmail OAuth"}
                        disabled={!gmailOAuth.configured}
                        onClick={() => connectGmailOAuth(item.email)}
                      >
                        <Link2 size={15} />
                      </button>
                      {connectedGmailEmails.has(item.email) ? (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-yellow-300 hover:bg-[#111b29]"
                          title="Hủy Gmail OAuth"
                          onClick={() => disconnectGmailOAuth(item.email)}
                        >
                          <Unplug size={15} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-red-300 hover:bg-[#111b29]"
                        title="Xóa email khỏi Email Pool"
                        onClick={() => deleteEmail(item.email)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid h-20 place-items-center text-sm text-muted">Chưa có {tab === "Email Pool" ? "email" : tab === "Proxy" ? "proxy" : "persona"}.</div>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
