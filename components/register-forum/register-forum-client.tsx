"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, MailCheck, Play, Plus, SendHorizonal, Trash2, X } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { buildCrawlerResultsQueryParams, loadCrawlerUrlViewState } from "@/lib/utils/crawler-url-view-state";

const EMAIL_STORAGE_KEY = "speed-core.email-pool";
const QUEUE_STORAGE_KEY = "speed-core.registration-queue";

type Candidate = {
  id: string;
  url: string;
  title: string | null;
  rating: string;
  score: number;
  siteType: string;
};

type EmailResource = {
  email: string;
  status: "ready" | "locked";
};

type QueueStatus = "Không xác định" | "Đang chạy" | "Đăng ký được" | "Không đăng ký được" | "Done" | "Bỏ qua";

type QueueItem = {
  url: string;
  title: string | null;
  rating: string;
  score: number;
  siteType: string;
  email: string | null;
  username: string;
  password?: string;
  note?: string;
  status: QueueStatus;
};

type RegistrationResult = {
  url: string;
  email: string;
  username: string;
  password: string;
  status: string;
  note: string;
};

type RegisteredAccount = {
  id: string;
  url: string;
  domain: string;
  email: string;
  username: string;
  password: string;
  note?: string;
  emailVerificationStatus?: string;
  emailVerificationNote?: string;
  emailVerifiedAt?: string;
  createdAt: string;
};

function normalizeStatus(status: string): QueueStatus {
  return status === "Đăng ký được" ? "Đăng ký được" : "Không đăng ký được";
}

function normalizeStoredStatus(status: string, note?: string): QueueStatus {
  if (status === "Chờ chạy") return "Không xác định";
  if (status === "Không đăng ký được" && /playwright|browserType\.launch|Executable doesn't exist|chromium/i.test(note ?? "")) {
    return "Không xác định";
  }
  if (["Không xác định", "Đang chạy", "Đăng ký được", "Không đăng ký được", "Done", "Bỏ qua"].includes(status)) {
    return status as QueueStatus;
  }
  if (["Đã đăng ký", "Cần xác minh email", "Đăng ký được"].includes(status)) return "Đăng ký được";
  return "Không xác định";
}

export function RegisterForumClient({ candidates }: { candidates: Candidate[] }) {
  const [emails, setEmails] = useState<EmailResource[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState("");
  const [copiedValue, setCopiedValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [verifyingAccountId, setVerifyingAccountId] = useState("");
  const [postingAccountId, setPostingAccountId] = useState("");
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [accounts, setAccounts] = useState<RegisteredAccount[]>([]);
  const [isPullingCrawler, setIsPullingCrawler] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEmails() {
      try {
        const storedEmails = window.localStorage.getItem(EMAIL_STORAGE_KEY);
        const localEmails = storedEmails ? (JSON.parse(storedEmails) as EmailResource[]) : [];
        const response = await fetch("/api/resources/email-pool", { cache: "no-store" });
        const payload = (await response.json()) as { items?: EmailResource[] };
        const serverEmails = payload.items ?? [];
        const emailsByAddress = new Map<string, EmailResource>();
        for (const item of [...localEmails, ...serverEmails]) emailsByAddress.set(item.email, item);
        if (!cancelled) setEmails([...emailsByAddress.values()]);
      } catch {
        try {
          const storedEmails = window.localStorage.getItem(EMAIL_STORAGE_KEY);
          if (!cancelled && storedEmails) setEmails(JSON.parse(storedEmails) as EmailResource[]);
        } catch {
          if (!cancelled) setEmails([]);
        }
      }
    }

    void loadEmails();

    async function loadAccounts() {
      try {
        const response = await fetch("/api/forum-registration/accounts", { cache: "no-store" });
        const payload = (await response.json()) as { items?: RegisteredAccount[] };
        if (!cancelled) setAccounts(payload.items ?? []);
      } catch {
        if (!cancelled) setAccounts([]);
      }
    }

    void loadAccounts();

    async function loadQueue() {
      try {
        const storedQueue = window.localStorage.getItem(QUEUE_STORAGE_KEY);
        const localItems = storedQueue ? (JSON.parse(storedQueue) as Array<QueueItem & { status: string }>) : [];
        const response = await fetch("/api/forum-registration/queue", { cache: "no-store" });
        const payload = (await response.json()) as { items?: Array<QueueItem & { status: string }> };
        const serverItems = payload.items ?? [];
        const merged = mergeQueueItems(
          serverItems.map((item) => ({ ...item, status: normalizeStoredStatus(item.status, item.note) })),
          localItems.map((item) => ({ ...item, status: normalizeStoredStatus(item.status, item.note) })),
        );
        if (cancelled) return;
        setQueue(merged);
        setQueueLoaded(true);
        window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(merged));
        if (localItems.length > 0 && merged.length >= serverItems.length) void persistQueue(merged);
      } catch {
        try {
          const storedQueue = window.localStorage.getItem(QUEUE_STORAGE_KEY);
          const storedItems = storedQueue ? (JSON.parse(storedQueue) as Array<QueueItem & { status: string }>) : [];
          if (!cancelled) setQueue(storedItems.map((item) => ({ ...item, status: normalizeStoredStatus(item.status, item.note) })));
        } catch {
          if (!cancelled) setQueue([]);
        } finally {
          if (!cancelled) setQueueLoaded(true);
        }
      }
    }

    void loadQueue();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!queueLoaded) return;
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    void persistQueue(queue);
  }, [queue, queueLoaded]);

  const readyEmails = useMemo(() => emails.filter((email) => email.status === "ready"), [emails]);
  const queuedUrls = useMemo(() => new Set(queue.map((item) => item.url)), [queue]);
  const availableCandidates = useMemo(
    () => (queueLoaded ? candidates.filter((candidate) => !queuedUrls.has(candidate.url)) : []),
    [candidates, queueLoaded, queuedUrls],
  );

  async function pullUrlsFromCrawlerRegister() {
    setIsPullingCrawler(true);
    try {
      const viewState = loadCrawlerUrlViewState();
      const params = buildCrawlerResultsQueryParams({ ...viewState, registerFilter: "has_register" });
      const response = await fetch(`/api/crawler/register-sync?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        items?: Array<{
          url: string;
          title: string | null;
          rating: string;
          score: number;
          siteType: string;
        }>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Không lấy được URL từ Crawler.");

      const nextItems = (payload.items ?? [])
        .filter((item) => !queuedUrls.has(item.url))
        .map((item) => ({
          url: item.url,
          title: item.title,
          rating: item.rating,
          score: item.score,
          siteType: item.siteType,
          email: null,
          username: "",
          status: "Không xác định" as const,
        }));

      if (nextItems.length === 0) {
        setMessage("Không có URL Register mới phù hợp bộ lọc Crawler URL hiện tại.");
        return;
      }

      setQueue((current) => mergeQueueItems(nextItems, current));
      setMessage(`Đã lấy ${nextItems.length} URL từ cột Register (theo bộ lọc depth/search/job trên Crawler URL).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không lấy được URL từ Crawler.");
    } finally {
      setIsPullingCrawler(false);
    }
  }

  function enqueueCandidates() {
    if (availableCandidates.length === 0) {
      setMessage("Không có website mới để đưa vào queue.");
      return;
    }

    const nextItems = availableCandidates.map((candidate, index) => ({
      url: candidate.url,
      title: candidate.title,
      rating: candidate.rating,
      score: candidate.score,
      siteType: candidate.siteType,
      email: null,
      username: "",
      status: "Không xác định" as const,
    }));

    setQueue((current) => mergeQueueItems(nextItems, current));
    setMessage(
      readyEmails.length > 0
        ? `Đã đưa ${nextItems.length} website vào queue và gán email khả dụng.`
        : `Đã đưa ${nextItems.length} website vào queue. Chưa có email khả dụng trong Email Pool.`,
    );
  }

  async function runItems(items: QueueItem[]) {
    if (items.length === 0) {
      setMessage("Không còn job Không xác định có email để chạy.");
      return;
    }

    setIsRunning(true);
    setMessage(`Đang chạy ${items.length} job. Nếu cửa sổ Chromium hiện challenge, hãy xử lý trong cửa sổ đó; automation sẽ tự tiếp tục sau khi qua.`);
    setQueue((current) => current.map((item) => (items.some((row) => row.url === item.url) ? { ...item, status: "Đang chạy" } : item)));

    try {
      const response = await fetch("/api/forum-registration/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, limit: items.length }),
      });
      const payload = (await response.json()) as { results?: RegistrationResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Registration run failed.");

      const results = payload.results ?? [];
      const accountsResponse = await fetch("/api/forum-registration/accounts", { cache: "no-store" }).catch(() => null);
      if (accountsResponse?.ok) {
        const accountsPayload = (await accountsResponse.json()) as { items?: RegisteredAccount[] };
        setAccounts(accountsPayload.items ?? []);
      }
      setQueue((current) =>
        current.map((item) => {
          const result = results.find((row) => row.url === item.url);
          return result
            ? {
                ...item,
                email: result.email,
                username: normalizeStatus(result.status) === "Đăng ký được" ? result.username : item.username,
                password: normalizeStatus(result.status) === "Đăng ký được" ? result.password : item.password,
                status: normalizeStatus(result.status),
                note: result.note,
              }
            : item;
        }),
      );
      setMessage(`Đã chạy xong ${results.length} job.`);
    } catch (error) {
      setQueue((current) =>
        current.map((item) =>
          item.status === "Đang chạy"
            ? { ...item, status: "Không đăng ký được", note: error instanceof Error ? error.message : "Unknown error" }
            : item,
        ),
      );
      setMessage(error instanceof Error ? error.message : "Không chạy được automation.");
    } finally {
      setIsRunning(false);
    }
  }

  function runRegistration() {
    const pending = queue.filter((item) => item.status === "Không xác định").slice(0, 5);
    void runItems(pending);
  }

  function rerunQueueItem(item: QueueItem) {
    void runItems([item]);
  }

  function updateQueueItem(url: string, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.url === url ? { ...item, ...patch } : item)));
  }

  async function deleteAccount(account: RegisteredAccount) {
    try {
      const response = await fetch(
        `/api/forum-registration/accounts?id=${encodeURIComponent(account.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete account failed.");

      const [accountsResponse, queueResponse] = await Promise.all([
        fetch("/api/forum-registration/accounts", { cache: "no-store" }),
        fetch("/api/forum-registration/queue", { cache: "no-store" }),
      ]);
      if (accountsResponse.ok) {
        const accountsPayload = (await accountsResponse.json()) as { items?: RegisteredAccount[] };
        setAccounts(accountsPayload.items ?? []);
      } else {
        setAccounts((current) => current.filter((item) => item.id !== account.id));
      }
      if (queueResponse.ok) {
        const queuePayload = (await queueResponse.json()) as { items?: Array<QueueItem & { status: string }> };
        setQueue((queuePayload.items ?? []).map((item) => ({ ...item, status: normalizeStoredStatus(item.status, item.note) })));
      }
      setMessage("Đã xóa account. Email vẫn được quyết định bởi Email Pool hiện tại.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được account.");
    }
  }

  async function verifyAccountEmail(account: RegisteredAccount) {
    setVerifyingAccountId(account.id);
    setMessage(`Đang dùng Email API để tìm email xác nhận cho ${account.email}...`);
    try {
      const response = await fetch("/api/forum-registration/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const payload = (await response.json()) as { status?: string; note?: string; error?: string };
      if (!response.ok) throw new Error(payload.note || payload.error || "Không xác nhận được email.");

      const accountsResponse = await fetch("/api/forum-registration/accounts", { cache: "no-store" });
      if (accountsResponse.ok) {
        const accountsPayload = (await accountsResponse.json()) as { items?: RegisteredAccount[] };
        setAccounts(accountsPayload.items ?? []);
      }
      setMessage(`${payload.status}: ${payload.note ?? ""}`);
    } catch (error) {
      const accountsResponse = await fetch("/api/forum-registration/accounts", { cache: "no-store" }).catch(() => null);
      if (accountsResponse?.ok) {
        const accountsPayload = (await accountsResponse.json()) as { items?: RegisteredAccount[] };
        setAccounts(accountsPayload.items ?? []);
      }
      setMessage(error instanceof Error ? error.message : "Không xác nhận được email.");
    } finally {
      setVerifyingAccountId("");
    }
  }

  async function postBacklink(account: RegisteredAccount) {
    setPostingAccountId(account.id);
    setMessage(`🚀 Đang đăng backlink lên ${account.domain || account.url}...`);
    try {
      const response = await fetch("/api/forum-registration/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: account.url,
          username: account.username,
          password: account.password,
          persona: { displayName: account.username, country: "US" },
          isDirectLogin: true,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; postedUrl?: string; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Đăng bài thất bại.");
      setMessage(`✅ Đăng backlink thành công! URL bài viết: ${payload.postedUrl}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đăng được backlink.");
    } finally {
      setPostingAccountId("");
    }
  }

  return (
    <div className="mt-7 grid gap-4 xl:grid-cols-2">
      <Panel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Ứng viên đăng ký</h2>
            <p className="text-sm text-muted">Website có đánh giá Xem xét, dùng để chạy thử đăng ký.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={!queueLoaded || isPullingCrawler} onClick={() => void pullUrlsFromCrawlerRegister()}>
              <Link2 size={16} />
              {isPullingCrawler ? "Đang lấy..." : "Lấy URL từ cột Register"}
            </Button>
            <Button type="button" disabled={!queueLoaded || availableCandidates.length === 0} onClick={enqueueCandidates}>
              <Plus size={16} />
              Enqueue ({availableCandidates.length})
            </Button>
          </div>
        </div>
        {!queueLoaded ? <p className="mt-3 text-sm text-muted">Đang tải Job queue đã lưu...</p> : null}
        {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
        <CandidateTable rows={availableCandidates} />
      </Panel>

      <Panel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Job queue ({queue.length})</h2>
            <p className="text-sm text-muted">Kết quả queue được lưu lại. Action dùng để chạy lại từng job hoặc đánh dấu thủ công.</p>
          </div>
          <Button type="button" disabled={queue.length === 0 || isRunning} onClick={runRegistration}>
            <Play size={16} />
            Chạy 5 job
          </Button>
        </div>
        <QueueTable
          rows={queue}
          isRunning={isRunning}
          copiedValue={copiedValue}
          onCopy={(value) => {
            if (!value || value === "-") return;
            void navigator.clipboard.writeText(value);
            setCopiedValue(value);
            window.setTimeout(() => setCopiedValue((current) => (current === value ? "" : current)), 1200);
          }}
          onRerun={rerunQueueItem}
          onUpdate={updateQueueItem}
        />
      </Panel>

      <Panel className="xl:col-span-2">
        <h2 className="text-base font-semibold">Account đã đăng ký ({accounts.length})</h2>
        <p className="text-sm text-muted">Mỗi lần đăng ký thành công sẽ tạo một dòng riêng, kể cả cùng một forum.</p>
        {message && <p className="mt-2 text-sm text-primary">{message}</p>}
        <AccountTable
          rows={accounts}
          copiedValue={copiedValue}
          verifyingAccountId={verifyingAccountId}
          postingAccountId={postingAccountId}
          onVerify={verifyAccountEmail}
          onDelete={deleteAccount}
          onPost={postBacklink}
          onCopy={(value) => {
            if (!value || value === "-") return;
            void navigator.clipboard.writeText(value);
            setCopiedValue(value);
            window.setTimeout(() => setCopiedValue((current) => (current === value ? "" : current)), 1200);
          }}
        />
      </Panel>
    </div>
  );
}

function CandidateTable({ rows }: { rows: Candidate[] }) {
  if (rows.length === 0) {
    return <EmptyTable headers={["URL", "Đánh giá", "Loại trang"]} message="Không còn ứng viên mới. Tất cả đã nằm trong Job queue." />;
  }

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
        <span>URL</span>
        <span>Đánh giá</span>
        <span>Loại trang</span>
      </div>
      <div className="max-h-[520px] divide-y divide-border overflow-auto">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-3 px-3 py-3 text-sm">
            <div className="min-w-0">
              <a className="block truncate font-medium text-white underline-offset-2 hover:underline" href={row.url} target="_blank" rel="noreferrer" title={row.url}>
                {row.url}
              </a>
              {row.title ? <p className="mt-0.5 truncate text-xs text-muted" title={row.title}>{row.title}</p> : null}
            </div>
            <span className="truncate font-semibold text-primary">{row.rating} · {row.score}</span>
            <span className="truncate text-white" title={row.siteType}>{row.siteType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountTable({
  rows,
  copiedValue,
  verifyingAccountId,
  postingAccountId,
  onCopy,
  onVerify,
  onDelete,
  onPost,
}: {
  rows: RegisteredAccount[];
  copiedValue: string;
  verifyingAccountId: string;
  postingAccountId: string;
  onCopy: (value: string) => void;
  onVerify: (row: RegisteredAccount) => void;
  onDelete: (row: RegisteredAccount) => void;
  onPost: (row: RegisteredAccount) => void;
}) {
  if (rows.length === 0) {
    return <EmptyTable headers={["Website", "Email", "Username", "Password", "Email verify", "Created", "Action"]} message="Chưa có account đăng ký thành công." />;
  }

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_210px_150px_150px_160px_130px_132px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
        <span>Website</span>
        <span>Email</span>
        <span>Username</span>
        <span>Password</span>
        <span>Email verify</span>
        <span>Created</span>
        <span>Action</span>
      </div>
      <div className="max-h-[360px] divide-y divide-border overflow-auto">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_210px_150px_150px_160px_130px_132px] items-center gap-3 px-3 py-3 text-sm">
            <div className="min-w-0">
              <a className="block truncate font-medium text-white underline-offset-2 hover:underline" href={row.url} target="_blank" rel="noreferrer" title={row.url}>
                {row.domain || row.url}
              </a>
              {row.note ? <p className="mt-0.5 truncate text-xs text-muted" title={row.note}>{row.note}</p> : null}
            </div>
            <CopyLine label="" value={row.email} copiedValue={copiedValue} onCopy={onCopy} className="text-muted" />
            <CopyLine label="" value={row.username || "-"} copiedValue={copiedValue} onCopy={onCopy} className="text-white" />
            <CopyLine label="" value={row.password || "-"} copiedValue={copiedValue} onCopy={onCopy} className="text-white" />
            <div className="min-w-0">
              <span className={`block truncate font-semibold ${row.emailVerifiedAt ? "text-primary" : row.emailVerificationStatus ? "text-red-300" : "text-yellow-300"}`}>
                {row.emailVerifiedAt ? "\u0110\u00e3 x\u00e1c nh\u1eadn email" : row.emailVerificationStatus || "Ch\u01b0a x\u00e1c nh\u1eadn"}
              </span>
              {row.emailVerificationNote ? <p className="mt-0.5 truncate text-xs text-muted" title={row.emailVerificationNote}>{row.emailVerificationNote}</p> : null}
            </div>
            <span className="truncate text-muted" title={row.createdAt}>{formatDate(row.createdAt)}</span>
            <div className="flex gap-1.5">
              {/* Post Backlink */}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="Đăng backlink lên forum này"
                disabled={Boolean(postingAccountId)}
                onClick={() => onPost(row)}
              >
                {postingAccountId === row.id
                  ? <SendHorizonal size={14} className="animate-pulse" />
                  : <SendHorizonal size={14} />}
              </button>
              {/* Verify Email */}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-primary hover:bg-[#111b29] disabled:cursor-not-allowed disabled:opacity-50"
                title="Xác minh email qua Email API"
                disabled={Boolean(verifyingAccountId)}
                onClick={() => onVerify(row)}
              >
                <MailCheck size={14} className={verifyingAccountId === row.id ? "animate-pulse" : ""} />
              </button>
              {/* Delete */}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-red-300 hover:bg-[#111b29]"
                title="Xóa account"
                onClick={() => onDelete(row)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueTable({
  rows,
  isRunning,
  copiedValue,
  onCopy,
  onRerun,
  onUpdate,
}: {
  rows: QueueItem[];
  isRunning: boolean;
  copiedValue: string;
  onCopy: (value: string) => void;
  onRerun: (row: QueueItem) => void;
  onUpdate: (url: string, patch: Partial<QueueItem>) => void;
}) {
  if (rows.length === 0) {
    return <EmptyTable headers={["Target", "Account", "Status", "Action"]} message="Chưa có job." />;
  }

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_220px_150px_116px] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
        <span>Target</span>
        <span>Email</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      <div className="max-h-[520px] divide-y divide-border overflow-auto">
        {rows.map((row) => (
          <div key={row.url} className="grid grid-cols-[minmax(0,1fr)_220px_150px_116px] gap-3 px-3 py-3 text-sm">
            <div className="min-w-0">
              <a className="block truncate font-medium text-white underline-offset-2 hover:underline" href={row.url} target="_blank" rel="noreferrer" title={row.url}>
                {row.url}
              </a>
              <p className="mt-0.5 truncate text-xs text-muted" title={row.note}>{row.note || `${row.rating} · ${row.score} · ${row.siteType}`}</p>
            </div>
            <div className="min-w-0 text-xs">
              <CopyLine label="" value={row.email ?? "Chưa gán email"} copiedValue={copiedValue} onCopy={onCopy} className="text-muted" />
            </div>
            <span className={`truncate font-semibold ${row.status === "Đăng ký được" || row.status === "Done" ? "text-primary" : row.status === "Đang chạy" || row.status === "Không xác định" ? "text-yellow-300" : "text-red-300"}`}>
              {row.status}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-white hover:bg-[#111b29] disabled:cursor-not-allowed disabled:opacity-50"
                title="Chạy lại job"
                disabled={isRunning}
                onClick={() => onRerun(row)}
              >
                <Play size={15} />
              </button>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-primary hover:bg-[#111b29]" title="Tôi đã xử lý xong" onClick={() => onUpdate(row.url, { status: "Done" })}>
                <Check size={15} />
              </button>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-[#0b111b] text-red-300 hover:bg-[#111b29]" title="Không xử lý được" onClick={() => onUpdate(row.url, { status: "Bỏ qua" })}>
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyLine({
  label,
  value,
  copiedValue,
  onCopy,
  className,
}: {
  label: string;
  value: string;
  copiedValue: string;
  onCopy: (value: string) => void;
  className?: string;
}) {
  const canCopy = value !== "-" && value !== "Chưa gán email";
  const copied = copiedValue === value;

  return (
    <button
      type="button"
      className={`block max-w-full truncate text-left ${className ?? ""} ${canCopy ? "cursor-pointer hover:text-primary" : "cursor-default"}`}
      title={canCopy ? `Click để copy ${value}` : value}
      disabled={!canCopy}
      onClick={() => onCopy(value)}
    >
      {label}{copied ? "Đã copy" : value}
    </button>
  );
}

function mergeQueueItems(primary: QueueItem[], secondary: QueueItem[]) {
  const byUrl = new Map<string, QueueItem>();
  for (const item of [...secondary, ...primary]) {
    const existing = byUrl.get(item.url);
    byUrl.set(item.url, { ...(existing ?? item), ...item });
  }
  return [...byUrl.values()];
}

async function persistQueue(queue: QueueItem[]) {
  await fetch("/api/forum-registration/queue", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: queue }),
  }).catch(() => undefined);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", { hour12: false });
}

function EmptyTable({ headers, message }: { headers: string[]; message: string }) {
  return (
    <div className="mt-6 rounded-md border border-border">
      <div
        className="grid border-b border-border px-3 py-3 text-sm font-semibold text-muted"
        style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
      >
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="grid h-20 place-items-center text-sm text-muted">{message}</div>
    </div>
  );
}
