"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Upload, Unlock, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";

const tabs = ["Email Pool", "User Pool", "Proxy", "Persona"];

type EmailPoolRow = {
  id: string;
  email: string;
  password_value: string;
  imap_host: string;
  imap_port: number;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type EmailPoolResponse = {
  rows: EmailPoolRow[];
  count: number;
  error?: string;
};

type UserPoolRow = {
  id: string;
  username: string;
  display_name: string | null;
  status: "available" | "locked" | "invalid" | "disabled" | "used";
  locked_by: string | null;
  locked_at: string | null;
  updated_at: string;
};

type UserPoolResponse = {
  rows: UserPoolRow[];
  count: number;
  error?: string;
};

export default function ResourcesPage() {
  const [tab, setTab] = useState("Email Pool");
  const [bulkEmails, setBulkEmails] = useState("user@gmail.com|app-password\nuser2@gmail.com|app-password");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [emails, setEmails] = useState<EmailPoolRow[]>([]);
  const [bulkUsers, setBulkUsers] = useState("john_smith\nanna.nguyen|Anna Nguyen");
  const [users, setUsers] = useState<UserPoolRow[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const [unlockingEmails, setUnlockingEmails] = useState(false);
  const [unlockingUsers, setUnlockingUsers] = useState(false);
  const [deletingEmailId, setDeletingEmailId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const emailCount = useMemo(() => emails.length, [emails]);
  const userCount = useMemo(() => users.length, [users]);

  async function loadEmails() {
    setLoadingEmails(true);
    setError("");
    try {
      const response = await fetch("/api/resources/emails", { cache: "no-store" });
      const data = (await response.json()) as EmailPoolResponse;
      if (!response.ok) throw new Error(data.error ?? "Không tải được email pool.");
      setEmails(data.rows);
    } catch (err) {
      setEmails([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingEmails(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setError("");
    try {
      const response = await fetch("/api/resources/users", { cache: "no-store" });
      const data = (await response.json()) as UserPoolResponse;
      if (!response.ok) throw new Error(data.error ?? "Khong tai duoc user pool.");
      setUsers(data.rows);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadEmails();
    void loadUsers();
  }, []);

  async function saveEmails() {
    setSavingEmails(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: bulkEmails,
          imapHost,
          imapPort: Number(imapPort),
        }),
      });
      const data = (await response.json()) as EmailPoolResponse & { saved?: number };
      if (!response.ok) throw new Error(data.error ?? "Không nạp được email.");
      setEmails(data.rows);
      setMessage(`Đã nạp ${data.saved ?? 0} email vào pool.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEmails(false);
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
      const data = (await response.json()) as EmailPoolResponse & { unlocked?: number };
      if (!response.ok) throw new Error(data.error ?? "Không mở khóa được email.");
      setEmails(data.rows);
      setMessage(`Đã mở khóa ${data.unlocked ?? 0} email bị kẹt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUnlockingEmails(false);
    }
  }

  async function saveUsers() {
    setSavingUsers(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: bulkUsers }),
      });
      const data = (await response.json()) as UserPoolResponse & { saved?: number };
      if (!response.ok) throw new Error(data.error ?? "Khong nap duoc user.");
      setUsers(data.rows);
      setMessage(`Da nap ${data.saved ?? 0} user vao pool.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUsers(false);
    }
  }

  async function unlockUsers() {
    setUnlockingUsers(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_stuck" }),
      });
      const data = (await response.json()) as UserPoolResponse & { unlocked?: number };
      if (!response.ok) throw new Error(data.error ?? "Khong mo khoa duoc user.");
      setUsers(data.rows);
      setMessage(`Da mo khoa ${data.unlocked ?? 0} user bi ket.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUnlockingUsers(false);
    }
  }

  async function deleteEmail(id: string) {
    setDeletingEmailId(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as EmailPoolResponse & { deleted?: number };
      if (!response.ok) throw new Error(data.error ?? "KhÃ´ng xÃ³a Ä‘Æ°á»£c email.");
      setEmails(data.rows);
      setMessage("ÄÃ£ xÃ³a email khá»i pool.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingEmailId(null);
    }
  }

  async function deleteUser(id: string) {
    setDeletingUserId(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/resources/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as UserPoolResponse & { deleted?: number };
      if (!response.ok) throw new Error(data.error ?? "Khong xoa duoc user.");
      setUsers(data.rows);
      setMessage("Da xoa user khoi pool.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <AppShell title="Tài nguyên">
      <h1 className="text-2xl font-semibold tracking-normal">Quản lý tài nguyên</h1>
      <p className="mt-1 text-sm text-muted">Kho dùng chung: Email, Proxy, Persona. Worker tự động khóa/mở khóa khi sử dụng.</p>
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
              <h2 className="text-base font-semibold">Nạp email (bulk)</h2>
              <p className="text-sm text-muted">Mỗi dòng: email|password</p>
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
                <Button onClick={saveEmails} disabled={savingEmails}>
                  {savingEmails ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Nạp
                </Button>
                <Button variant="ghost" onClick={unlockEmails} disabled={unlockingEmails}>
                  {unlockingEmails ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                  Mở khóa kẹt
                </Button>
              </div>
              {message && <p className="mt-3 text-sm text-primary">{message}</p>}
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </>
          )}
          {tab === "User Pool" && (
            <>
              <h2 className="text-base font-semibold">Nap user (bulk)</h2>
              <p className="text-sm text-muted">Moi dong: username hoac username|display name</p>
              <Textarea className="mt-7 h-44 w-full" value={bulkUsers} onChange={(event) => setBulkUsers(event.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={saveUsers} disabled={savingUsers}>
                  {savingUsers ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Nap user
                </Button>
                <Button variant="ghost" onClick={unlockUsers} disabled={unlockingUsers}>
                  {unlockingUsers ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                  Mo khoa ket
                </Button>
              </div>
              {message && <p className="mt-3 text-sm text-primary">{message}</p>}
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </>
          )}
          {tab === "Proxy" && (
            <>
              <h2 className="text-base font-semibold">Nạp proxy</h2>
              <p className="font-mono text-sm text-muted">host:port:user:pass</p>
              <Textarea className="mt-7 h-44 w-full" defaultValue="1.2.3.4:8080:user:pass" />
              <label className="mb-1 mt-4 block text-sm font-semibold">Loại</label>
              <Select className="w-full"><option>Residential</option><option>Datacenter</option></Select>
              <Button className="mt-3"><Upload size={16} />Nạp</Button>
            </>
          )}
          {tab === "Persona" && (
            <>
              <h2 className="text-base font-semibold">Thêm persona</h2>
              <p className="text-sm text-muted">Bộ hồ sơ ảo cho tool đóng giả người dùng.</p>
              <div className="mt-7 space-y-4">
                <div><label className="mb-1 block text-sm font-semibold">Display name</label><Input className="w-full" /></div>
                <div><label className="mb-1 block text-sm font-semibold">Username base</label><Input className="w-full" defaultValue="johnny_smith" /></div>
                <div><label className="mb-1 block text-sm font-semibold">Bio</label><Textarea className="h-14 w-full" /></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-sm font-semibold">Gender</label><Input className="w-full" /></div><div><label className="mb-1 block text-sm font-semibold">Country</label><Input className="w-full" /></div></div>
                <Button>Thêm persona</Button>
              </div>
            </>
          )}
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {tab === "Email Pool" ? "Email pool" : tab === "User Pool" ? "User pool" : tab === "Proxy" ? "Proxy pool" : "Personas"} ({tab === "Email Pool" ? emailCount : tab === "User Pool" ? userCount : 0})
            </h2>
            {tab === "Email Pool" && (
              <Button className="h-8 px-2 text-xs" variant="ghost" onClick={() => setShowPasswords((value) => !value)}>
                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              </Button>
            )}
          </div>
          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_40px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
              <span>{tab === "Email Pool" ? "Email" : tab === "User Pool" ? "Username" : tab === "Proxy" ? "Endpoint" : "Name"}</span>
              <span>{tab === "Email Pool" ? "Password" : tab === "User Pool" ? "Display name" : ""}</span>
              <span>{tab === "Email Pool" ? "IMAP" : tab === "User Pool" ? "Locked by" : tab === "Proxy" ? "Type" : "Username"}</span>
              <span>Status</span>
              <span></span>
            </div>
            {tab === "Email Pool" && (
              <>
                {loadingEmails && <div className="grid h-20 place-items-center text-sm text-muted">Đang tải email...</div>}
                {!loadingEmails && emails.length === 0 && <div className="grid h-20 place-items-center text-sm text-muted">Chưa có email.</div>}
                {!loadingEmails && emails.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_40px] items-center border-b border-border/60 px-3 py-3 text-sm last:border-b-0">
                    <span className="truncate pr-3 font-mono">{row.email}</span>
                    <span className="truncate pr-3 font-mono text-muted">{showPasswords ? row.password_value : "••••••••"}</span>
                    <span className="truncate pr-3 font-mono text-muted">{row.imap_host}:{row.imap_port}</span>
                    <span className="capitalize text-muted">{row.status.replace("_", " ")}</span>
                    <button
                      type="button"
                      title="Xóa email"
                      aria-label={`Xóa ${row.email}`}
                      onClick={() => void deleteEmail(row.id)}
                      disabled={deletingEmailId === row.id}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:border-red-400/50 hover:bg-red-950/30 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingEmailId === row.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </div>
                ))}
              </>
            )}
            {tab === "User Pool" && (
              <>
                {loadingUsers && <div className="grid h-20 place-items-center text-sm text-muted">Đang tải user...</div>}
                {!loadingUsers && users.length === 0 && <div className="grid h-20 place-items-center text-sm text-muted">Chưa có user.</div>}
                {!loadingUsers && users.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_40px] items-center border-b border-border/60 px-3 py-3 text-sm last:border-b-0">
                    <span className="truncate pr-3 font-mono">{row.username}</span>
                    <span className="truncate pr-3 text-muted">{row.display_name ?? "-"}</span>
                    <span className="truncate pr-3 text-muted">{row.locked_by ?? "-"}</span>
                    <span className="capitalize text-muted">{row.status.replace("_", " ")}</span>
                    <button
                      type="button"
                      title="Xóa user"
                      aria-label={`Xóa ${row.username}`}
                      onClick={() => void deleteUser(row.id)}
                      disabled={deletingUserId === row.id}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:border-red-400/50 hover:bg-red-950/30 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingUserId === row.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </div>
                ))}
              </>
            )}
            {tab !== "Email Pool" && tab !== "User Pool" && (
              <div className="grid h-20 place-items-center text-sm text-muted">Chưa có {tab === "Proxy" ? "proxy" : "persona"}.</div>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
