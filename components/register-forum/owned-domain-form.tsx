"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { addOwnedDomainAction } from "@/app/register-forum/actions";
import { Button, Input } from "@/components/ui";
import type { OwnedSiteDomainRow } from "@/lib/types/registration";

export function OwnedDomainForm({ domains }: { domains: OwnedSiteDomainRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const result = await addOwnedDomainAction({ domain, label });
      setMessage(result.ok ? "Da them owned domain" : result.error ?? "Luu domain that bai");
      if (result.ok) {
        setDomain("");
        setLabel("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-md border border-border bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">Owned site allowlist</h3>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="domain-ban-so-huu.com" />
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ghi chu / brand" />
        <Button variant="ghost" onClick={save} disabled={isPending}>
          Them domain
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {domains.length ? (
          domains.slice(0, 12).map((item) => (
            <span key={item.id} className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary">
              {item.domain}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted">Chua co domain nao trong allowlist.</span>
        )}
      </div>
    </div>
  );
}
