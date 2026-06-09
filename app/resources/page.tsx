"use client";

import { useEffect, useState, useTransition } from "react";
import { Upload, Unlock, Trash2, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import type { EmailRow, ProxyRow, PersonaRow } from "@/lib/types/resources";

const tabs = ["Email Pool", "Proxy", "Persona"];

export default function ResourcesPage() {
  const [tab, setTab] = useState("Email Pool");

  // State arrays and pagination
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [emailsCount, setEmailsCount] = useState(0);
  const [emailsPage, setEmailsPage] = useState(1);

  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [proxiesCount, setProxiesCount] = useState(0);
  const [proxiesPage, setProxiesPage] = useState(1);

  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [personasCount, setPersonasCount] = useState(0);
  const [personasPage, setPersonasPage] = useState(1);

  // Bulk / Forms input states
  const [emailBulkText, setEmailBulkText] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");

  const [proxyBulkText, setProxyBulkText] = useState("");
  const [proxyType, setProxyType] = useState<"Residential" | "Datacenter">("Residential");

  const [personaDisplayName, setPersonaDisplayName] = useState("");
  const [personaUsernameBase, setPersonaUsernameBase] = useState("");
  const [personaBio, setPersonaBio] = useState("");
  const [personaGender, setPersonaGender] = useState("");
  const [personaCountry, setPersonaCountry] = useState("");

  // Selection states
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedProxies, setSelectedProxies] = useState<string[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);

  // Errors and transitions
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // --- ACTIONS ---

  async function fetchEmails() {
    try {
      const res = await fetch(`/api/resources/emails?page=${emailsPage}&pageSize=10`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.rows);
        setEmailsCount(data.count);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchProxies() {
    try {
      const res = await fetch(`/api/resources/proxies?page=${proxiesPage}&pageSize=10`);
      if (res.ok) {
        const data = await res.json();
        setProxies(data.rows);
        setProxiesCount(data.count);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchPersonas() {
    try {
      const res = await fetch(`/api/resources/personas?page=${personasPage}&pageSize=10`);
      if (res.ok) {
        const data = await res.json();
        setPersonas(data.rows);
        setPersonasCount(data.count);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Refetch lists when page or tab changes
  useEffect(() => {
    setError(null);
    setSuccess(null);
    if (tab === "Email Pool") {
      void fetchEmails();
    } else if (tab === "Proxy") {
      void fetchProxies();
    } else if (tab === "Persona") {
      void fetchPersonas();
    }
  }, [tab, emailsPage, proxiesPage, personasPage]);

  // Bulk upload emails
  function handleAddEmails() {
    if (!emailBulkText.trim()) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/resources/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bulkText: emailBulkText,
            imapHost,
            imapPort: Number(imapPort) || 993,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(`Đã nạp thành công ${data.count} email.`);
          setEmailBulkText("");
          setEmailsPage(1);
          await fetchEmails();
        } else {
          setError(data.error || "Lỗi khi nạp email.");
        }
      } catch (err) {
        setError("Không thể kết nối đến server.");
      }
    });
  }

  // Unlock stuck emails
  function handleUnlockEmails() {
    const ids = selectedEmails.length > 0 ? selectedEmails : emails.map((e) => e.id);
    if (ids.length === 0) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/resources/emails", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          setSuccess("Đã mở khóa các email đang kẹt.");
          setSelectedEmails([]);
          await fetchEmails();
        } else {
          const data = await res.json();
          setError(data.error || "Lỗi khi mở khóa email.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Delete emails
  async function handleDeleteEmails() {
    if (selectedEmails.length === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/resources/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedEmails }),
      });
      if (res.ok) {
        setSelectedEmails([]);
        await fetchEmails();
      } else {
        const data = await res.json();
        setError(data.error || "Không thể xóa email.");
      }
    } catch (err) {
      setError("Lỗi kết nối.");
    }
  }

  // Bulk upload proxies
  function handleAddProxies() {
    if (!proxyBulkText.trim()) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/resources/proxies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bulkText: proxyBulkText,
            type: proxyType,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(`Đã nạp thành công ${data.count} proxy.`);
          setProxyBulkText("");
          setProxiesPage(1);
          await fetchProxies();
        } else {
          setError(data.error || "Lỗi khi nạp proxy.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Delete proxies
  async function handleDeleteProxies() {
    if (selectedProxies.length === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/resources/proxies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedProxies }),
      });
      if (res.ok) {
        setSelectedProxies([]);
        await fetchProxies();
      } else {
        const data = await res.json();
        setError(data.error || "Không thể xóa proxy.");
      }
    } catch (err) {
      setError("Lỗi kết nối.");
    }
  }

  // Create persona
  function handleAddPersona() {
    if (!personaDisplayName.trim() || !personaUsernameBase.trim()) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/resources/personas", {
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
        if (res.ok) {
          setSuccess("Đã thêm Persona thành công.");
          setPersonaDisplayName("");
          setPersonaUsernameBase("");
          setPersonaBio("");
          setPersonaGender("");
          setPersonaCountry("");
          setPersonasPage(1);
          await fetchPersonas();
        } else {
          const data = await res.json();
          setError(data.error || "Lỗi khi thêm Persona.");
        }
      } catch (err) {
        setError("Lỗi kết nối.");
      }
    });
  }

  // Delete personas
  async function handleDeletePersonas() {
    if (selectedPersonas.length === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/resources/personas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedPersonas }),
      });
      if (res.ok) {
        setSelectedPersonas([]);
        await fetchPersonas();
      } else {
        const data = await res.json();
        setError(data.error || "Không thể xóa persona.");
      }
    } catch (err) {
      setError("Lỗi kết nối.");
    }
  }

  // General helper variables
  const activeCount = tab === "Email Pool" ? emailsCount : tab === "Proxy" ? proxiesCount : personasCount;
  const totalPages = Math.max(1, Math.ceil(activeCount / 10));
  const currentPage = tab === "Email Pool" ? emailsPage : tab === "Proxy" ? proxiesPage : personasPage;
  const setPage = tab === "Email Pool" ? setEmailsPage : tab === "Proxy" ? setProxiesPage : setPersonasPage;

  return (
    <AppShell title="Tài nguyên">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal text-white">Quản lý tài nguyên</h1>
        <p className="text-sm text-muted">
          Kho dùng chung: Email, Proxy, Persona. Worker tự động khoá/mở khoá khi sử dụng.
        </p>
      </div>

      <div className="mt-7 inline-flex rounded-md bg-[#162130] p-1">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => {
              setTab(item);
              setError(null);
              setSuccess(null);
            }}
            className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
              tab === item ? "bg-[#070c14] text-white" : "text-muted hover:text-slate-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[480px_1fr]">
        {/* Nạp tài nguyên Form Panel */}
        <Panel>
          {tab === "Email Pool" && (
            <>
              <h2 className="text-base font-semibold text-white">Nạp email (bulk)</h2>
              <p className="text-sm text-muted">Mỗi dòng định dạng: email|password</p>
              <Textarea
                className="mt-6 h-44 w-full font-mono text-xs"
                value={emailBulkText}
                onChange={(e) => setEmailBulkText(e.target.value)}
                placeholder="user@outlook.com|abc123&#10;user2@gmail.com|xyz456"
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">IMAP host</label>
                  <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="w-full text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Port</label>
                  <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className="w-full text-sm" />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button onClick={handleAddEmails} disabled={isPending || !emailBulkText.trim()} className="flex items-center gap-1.5 text-sm">
                  {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  Nạp
                </Button>
                <Button variant="ghost" onClick={handleUnlockEmails} disabled={isPending} className="flex items-center gap-1.5 text-sm">
                  <Unlock size={14} />
                  Mở khoá kẹt ({selectedEmails.length > 0 ? selectedEmails.length : "Tất cả"})
                </Button>
              </div>
            </>
          )}

          {tab === "Proxy" && (
            <>
              <h2 className="text-base font-semibold text-white">Nạp proxy (bulk)</h2>
              <p className="text-sm text-muted">Định dạng: host:port hoặc host:port:user:pass</p>
              <Textarea
                className="mt-6 h-44 w-full font-mono text-xs"
                value={proxyBulkText}
                onChange={(e) => setProxyBulkText(e.target.value)}
                placeholder="1.2.3.4:8080&#10;5.6.7.8:1080:myuser:mypassword"
              />
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-slate-300">Loại Proxy</label>
                <Select
                  value={proxyType}
                  onChange={(e) => setProxyType(e.target.value as "Residential" | "Datacenter")}
                  className="w-full text-sm"
                >
                  <option value="Residential">Residential</option>
                  <option value="Datacenter">Datacenter</option>
                </Select>
              </div>
              <Button onClick={handleAddProxies} disabled={isPending || !proxyBulkText.trim()} className="mt-5 flex items-center gap-1.5 text-sm">
                {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                Nạp proxy
              </Button>
            </>
          )}

          {tab === "Persona" && (
            <>
              <h2 className="text-base font-semibold text-white">Thêm Persona ảo</h2>
              <p className="text-sm text-muted">Bộ hồ sơ ảo dùng đóng vai khi đăng ký và viết bài trên forum.</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Tên hiển thị (Display Name)</label>
                  <Input
                    value={personaDisplayName}
                    onChange={(e) => setPersonaDisplayName(e.target.value)}
                    className="w-full text-sm"
                    placeholder="VD: David Sterling"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Username base (Tên gốc)</label>
                  <Input
                    value={personaUsernameBase}
                    onChange={(e) => setPersonaUsernameBase(e.target.value)}
                    className="w-full text-sm"
                    placeholder="VD: sterling_david"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Tiểu sử (Bio)</label>
                  <Textarea
                    value={personaBio}
                    onChange={(e) => setPersonaBio(e.target.value)}
                    className="h-16 w-full text-sm"
                    placeholder="VD: SEO consultant & tech enthusiast"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">Giới tính</label>
                    <Input
                      value={personaGender}
                      onChange={(e) => setPersonaGender(e.target.value)}
                      className="w-full text-sm"
                      placeholder="Male / Female"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">Quốc gia</label>
                    <Input
                      value={personaCountry}
                      onChange={(e) => setPersonaCountry(e.target.value)}
                      className="w-full text-sm"
                      placeholder="US / UK / VN"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddPersona}
                  disabled={isPending || !personaDisplayName.trim() || !personaUsernameBase.trim()}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <Plus size={14} />
                  Thêm Persona
                </Button>
              </div>
            </>
          )}
        </Panel>

        {/* View list Panel */}
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">
              {tab === "Email Pool" ? "Danh sách Email" : tab === "Proxy" ? "Danh sách Proxy" : "Hồ sơ Persona"} ({activeCount})
            </h2>

            {/* Bulk Delete triggers */}
            {tab === "Email Pool" && selectedEmails.length > 0 && (
              <Button variant="danger" onClick={handleDeleteEmails} className="flex items-center gap-1 h-8 px-2.5 text-xs">
                <Trash2 size={13} /> Xóa ({selectedEmails.length})
              </Button>
            )}
            {tab === "Proxy" && selectedProxies.length > 0 && (
              <Button variant="danger" onClick={handleDeleteProxies} className="flex items-center gap-1 h-8 px-2.5 text-xs">
                <Trash2 size={13} /> Xóa ({selectedProxies.length})
              </Button>
            )}
            {tab === "Persona" && selectedPersonas.length > 0 && (
              <Button variant="danger" onClick={handleDeletePersonas} className="flex items-center gap-1 h-8 px-2.5 text-xs">
                <Trash2 size={13} /> Xóa ({selectedPersonas.length})
              </Button>
            )}
          </div>

          <div className="mt-6 w-full overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#101722] text-muted font-medium">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={
                        tab === "Email Pool"
                          ? emails.length > 0 && selectedEmails.length === emails.length
                          : tab === "Proxy"
                          ? proxies.length > 0 && selectedProxies.length === proxies.length
                          : personas.length > 0 && selectedPersonas.length === personas.length
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (tab === "Email Pool") {
                          setSelectedEmails(checked ? emails.map((item) => item.id) : []);
                        } else if (tab === "Proxy") {
                          setSelectedProxies(checked ? proxies.map((item) => item.id) : []);
                        } else if (tab === "Persona") {
                          setSelectedPersonas(checked ? personas.map((item) => item.id) : []);
                        }
                      }}
                    />
                  </th>
                  {tab === "Email Pool" && (
                    <>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">IMAP Config</th>
                      <th className="px-3 py-3 w-28">Trạng thái</th>
                    </>
                  )}
                  {tab === "Proxy" && (
                    <>
                      <th className="px-3 py-3">Địa chỉ (Endpoint)</th>
                      <th className="px-3 py-3">Phân loại</th>
                      <th className="px-3 py-3 w-28">Trạng thái</th>
                    </>
                  )}
                  {tab === "Persona" && (
                    <>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Username base</th>
                      <th className="px-3 py-3">Quốc gia/Giới tính</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tab === "Email Pool" &&
                  (emails.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-muted">Chưa có email trong kho.</td>
                    </tr>
                  ) : (
                    emails.map((row) => (
                      <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEmails.includes(row.id)}
                            onChange={(e) =>
                              setSelectedEmails((curr) =>
                                e.target.checked ? [...curr, row.id] : curr.filter((id) => id !== row.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-100 font-medium">{row.email}</td>
                        <td className="px-3 py-3 text-muted text-xs">
                          {row.imap_host}:{row.imap_port}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                              row.status === "available"
                                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/40"
                                : row.status === "locked"
                                ? "bg-amber-950/40 text-amber-300 border border-amber-900/40"
                                : "bg-slate-900 text-slate-400"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ))}

                {tab === "Proxy" &&
                  (proxies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-muted">Chưa có proxy trong kho.</td>
                    </tr>
                  ) : (
                    proxies.map((row) => (
                      <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedProxies.includes(row.id)}
                            onChange={(e) =>
                              setSelectedProxies((curr) =>
                                e.target.checked ? [...curr, row.id] : curr.filter((id) => id !== row.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-100 font-medium">
                          {row.host}:{row.port}
                          {row.username ? <span className="text-xs text-muted block">Auth: {row.username}</span> : null}
                        </td>
                        <td className="px-3 py-3 text-muted">{row.type}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                              row.status === "available"
                                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/40"
                                : row.status === "locked"
                                ? "bg-amber-950/40 text-amber-300 border border-amber-900/40"
                                : "bg-red-950/40 text-red-300 border border-red-900/40"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ))}

                {tab === "Persona" &&
                  (personas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-muted">Chưa có persona.</td>
                    </tr>
                  ) : (
                    personas.map((row) => (
                      <tr key={row.id} className="hover:bg-[#0e1726]/40 transition-colors">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPersonas.includes(row.id)}
                            onChange={(e) =>
                              setSelectedPersonas((curr) =>
                                e.target.checked ? [...curr, row.id] : curr.filter((id) => id !== row.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-100 font-medium">
                          {row.display_name}
                          {row.bio ? <span className="text-xs text-muted block truncate max-w-xs">{row.bio}</span> : null}
                        </td>
                        <td className="px-3 py-3 text-muted">{row.username_base}</td>
                        <td className="px-3 py-3 text-muted text-xs">
                          {row.country || "-"}{row.gender ? ` / ${row.gender}` : ""}
                        </td>
                      </tr>
                    ))
                  ))}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination controls */}
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
            <Button
              variant="ghost"
              onClick={() => setPage((val) => Math.max(1, val - 1))}
              disabled={currentPage <= 1}
              className="h-8 px-2.5 text-xs"
            >
              Trước
            </Button>
            <span>
              Trang {currentPage}/{totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setPage((val) => Math.min(totalPages, val + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2.5 text-xs"
            >
              Sau
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
