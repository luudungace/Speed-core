"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw, SearchCheck, Square } from "lucide-react";
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
  const [state, setState] = useState<"idle" | "running" | "paused" | "cancelled">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, failed: 0 });
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const uniqueCandidates = useMemo(() => uniqueByRegisterUrl(candidates), [candidates]);
  const uniqueCount = uniqueCandidates.length;

  async function waitWhilePaused() {
    while (pauseRef.current && !cancelRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  async function run() {
    pauseRef.current = false;
    cancelRef.current = false;
    setState("running");
    setMessage(null);
    setProgress({ done: 0, total: uniqueCandidates.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    try {
      for (let index = 0; index < uniqueCandidates.length; index += 1) {
        await waitWhilePaused();
        if (cancelRef.current) break;

        const candidate = uniqueCandidates[index];
        setMessage(`Dang xu ly ${index + 1}/${uniqueCandidates.length}: ${candidate.domain}`);
        abortRef.current = new AbortController();
        const result = await registerOne(candidate, abortRef.current.signal);
        abortRef.current = null;

        if (result.ok) success += 1;
        else failed += 1;

        setProgress({ done: index + 1, total: uniqueCandidates.length, success, failed });
        router.refresh();
      }

      if (cancelRef.current) {
        setState("cancelled");
        setMessage(`Da huy dang ky. Da xu ly ${success + failed}/${uniqueCandidates.length}: thanh cong ${success}, loi ${failed}.`);
        return;
      }

      setState("idle");
      setMessage(`Da xu ly ${uniqueCandidates.length} URL: thanh cong ${success}, loi ${failed}.`);
    } catch (error) {
      if (cancelRef.current) {
        setState("cancelled");
        setMessage(`Da huy dang ky. Da xu ly ${success + failed}/${uniqueCandidates.length}: thanh cong ${success}, loi ${failed}.`);
      } else {
        setState("idle");
        setMessage(toMessage(error, "Dang ky tu dong that bai"));
      }
    } finally {
      abortRef.current = null;
      router.refresh();
    }
  }

  function pause() {
    pauseRef.current = true;
    setState("paused");
    setMessage(`Da tam dung tai ${progress.done}/${progress.total} URL.`);
  }

  function resume() {
    pauseRef.current = false;
    setState("running");
    setMessage(`Dang tiep tuc tu ${progress.done}/${progress.total} URL.`);
  }

  function cancel() {
    cancelRef.current = true;
    pauseRef.current = false;
    abortRef.current?.abort();
    setState("cancelled");
    setMessage("Dang huy dang ky...");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={run} disabled={state === "running" || state === "paused" || uniqueCandidates.length === 0}>
          {state === "running" ? <RefreshCw size={16} className="animate-spin" /> : <SearchCheck size={16} />}
        Dang ky tu dong ({uniqueCount} URL)
        </Button>
        {state === "paused" ? (
          <Button variant="ghost" onClick={resume}>
            <Play size={16} />
            Tiep tuc
          </Button>
        ) : (
          <Button variant="ghost" onClick={pause} disabled={state !== "running"}>
            <Pause size={16} />
            Tam dung
          </Button>
        )}
        <Button variant="danger" onClick={cancel} disabled={state !== "running" && state !== "paused"}>
          <Square size={16} />
          Huy dang ky
        </Button>
      </div>
      {progress.total > 0 && state !== "idle" ? (
        <p className="max-w-72 text-right font-mono text-[11px] leading-4 text-muted">
          {progress.done}/{progress.total} · OK {progress.success} · Loi {progress.failed}
        </p>
      ) : null}
      {message ? <p className="max-w-72 text-right text-xs leading-5 text-muted">{message}</p> : null}
    </div>
  );
}

async function registerOne(candidate: BulkCandidate, signal: AbortSignal) {
  const response = await fetch("/api/register-forum/auto-register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(candidate),
    signal,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("API bi redirect hoac chua dang nhap. Hay reload trang va dang nhap lai.");
  }
  const data = (await response.json()) as { ok?: boolean; error?: unknown; message?: string };
  if (!response.ok || !data.ok) return { ok: false, message: toMessage(data.error, "Dang ky URL that bai") };
  return { ok: true, message: data.message ?? "OK" };
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

function uniqueByRegisterUrl(items: BulkCandidate[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrlKey(item.registerUrl);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
