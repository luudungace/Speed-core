"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, SearchCheck } from "lucide-react";
import { syncRegistrationCandidatesAction } from "@/app/register-forum/actions";
import { Button } from "@/components/ui";

const CRAWLER_VIEW_STATE_KEY = "crawler_url_view_state";

type BulkCandidate = {
  domain: string;
  registerUrl: string;
  cmsType: string;
};

export function BulkAutoRegisterButton({ candidates }: { candidates: BulkCandidate[] }) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uniqueCount = useMemo(() => new Set(candidates.map((item) => normalizeUrlKey(item.registerUrl))).size, [candidates]);

  async function run() {
    setIsRunning(true);
    setMessage(null);
    const interval = setInterval(() => {
      router.refresh();
    }, 2500);

    try {
      const response = await fetch("/api/register-forum/auto-register-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ candidates }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("API bi redirect hoac chua dang nhap. Hay reload trang va dang nhap lai.");
      }
      const data = (await response.json()) as {
        ok?: boolean;
        total?: number;
        success?: number;
        failed?: number;
        accountSaveFailed?: number;
        accountSaveError?: string | null;
        error?: string;
      };
      if (!response.ok || !data.ok) throw new Error(toMessage(data.error, "Dang ky tu dong that bai"));
      const saveWarning = data.accountSaveFailed
        ? ` Khong luu duoc ${data.accountSaveFailed} dong vao Ket qua account: ${data.accountSaveError ?? "loi khong xac dinh"}.`
        : "";
      setMessage(`Da xu ly ${data.total ?? 0} URL: thanh cong ${data.success ?? 0}, loi ${data.failed ?? 0}.${saveWarning}`);
    } catch (error) {
      setMessage(toMessage(error, "Dang ky tu dong that bai"));
    } finally {
      clearInterval(interval);
      setIsRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={run} disabled={isRunning || candidates.length === 0}>
        {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <SearchCheck size={16} />}
        Dang ky tu dong ({uniqueCount} URL)
      </Button>
      {message ? <p className="max-w-72 text-right text-xs leading-5 text-muted">{message}</p> : null}
    </div>
  );
}

function normalizeUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function toMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(record);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function SyncRegistrationCandidatesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<unknown>(null);

  function sync() {
    startTransition(async () => {
      try {
        const result = await syncRegistrationCandidatesAction(readCrawlerViewState());
        setMessage(result.ok ? `Da thay bang URL dang ky bang ${result.count} URL moi` : result.error);
        router.refresh();
      } catch (error) {
        setMessage(error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" onClick={sync} disabled={isPending}>
        {isPending ? <RefreshCw size={16} className="animate-spin" /> : <SearchCheck size={16} />}
        Lay URL tu cot Register
      </Button>
      {message ? <p className="max-w-56 text-right text-[11px] leading-4 text-muted">{toMessage(message, "Sync failed")}</p> : null}
    </div>
  );
}

function readCrawlerViewState() {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(CRAWLER_VIEW_STATE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      cms: typeof parsed.cms === "string" ? parsed.cms : "All CMS",
      statusFilter: typeof parsed.statusFilter === "string" ? parsed.statusFilter : "all",
      urlDepth: typeof parsed.urlDepth === "string" ? parsed.urlDepth : "Táº¥t cáº£ URL",
      resultJobId: typeof parsed.resultJobId === "string" ? parsed.resultJobId : null,
    };
  } catch {
    return {};
  }
}
