import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";

export default function RegisterForumPage() {
  return (
    <AppShell title="Đăng ký diễn đàn">
      <h1 className="text-2xl font-semibold tracking-normal">Đăng ký diễn đàn</h1>
      <p className="mt-1 text-sm text-muted">Enqueue URL cho worker Python pull về xử lý qua endpoint /api/public/worker/*.</p>
      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-start justify-between">
            <div><h2 className="text-base font-semibold">Ứng viên đăng ký</h2><p className="text-sm text-muted">URL đã phát hiện CMS rõ ràng.</p></div>
            <Button><Plus size={16} />Enqueue (0)</Button>
          </div>
          <EmptyTable headers={["URL", "CMS"]} message="Chưa có URL đã phân loại CMS." />
        </Panel>
        <Panel>
          <h2 className="text-base font-semibold">Job queue (0)</h2>
          <EmptyTable headers={["Target", "CMS", "Status", "Username"]} message="Chưa có job." />
        </Panel>
      </div>
    </AppShell>
  );
}

function EmptyTable({ headers, message }: { headers: string[]; message: string }) {
  return (
    <div className="mt-6 rounded-md border border-border">
      <div className="grid border-b border-border px-3 py-3 text-sm font-semibold text-muted" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="grid h-20 place-items-center text-sm text-muted">{message}</div>
    </div>
  );
}
