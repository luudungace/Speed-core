"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { hideRegistrationUrlAction } from "@/app/register-forum/actions";

type HideUrlButtonProps = {
  domain: string;
  url: string;
  cmsType: string;
};

export function HideUrlButton({ domain, url, cmsType }: HideUrlButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function hide() {
    startTransition(async () => {
      const result = await hideRegistrationUrlAction({ domain, url, cmsType });
      if (result.ok) {
        router.refresh();
        return;
      }
      setMessage(result.error ?? "Khong xoa duoc URL");
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={hide}
        disabled={isPending}
        title="Ẩn URL này khỏi danh sách đăng ký"
        aria-label={`Ẩn ${url}`}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted transition hover:border-red-400/50 hover:bg-red-950/30 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
      {message ? <span className="max-w-24 truncate text-[10px] text-red-300" title={message}>{message}</span> : null}
    </div>
  );
}
