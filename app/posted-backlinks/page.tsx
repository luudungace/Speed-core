import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";

export default function PostedBacklinksPage() {
  return (
    <AppShell title="Backlink đã đăng">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Backlink đã đăng</h1>
          <p className="mt-1 text-sm text-muted">Thành phẩm cuối: URL bài viết worker đăng thành công.</p>
        </div>
        <Button variant="ghost"><Download size={16} />Export XLSX</Button>
      </div>
      <Panel className="mt-7">
        <h2 className="text-base font-semibold">Posts (0)</h2>
        <div className="mt-6 rounded-md border border-border">
          <div className="grid grid-cols-4 border-b border-border px-3 py-3 text-sm font-semibold text-muted">
            <span>Forum</span><span>Posted URL</span><span>Status</span><span>Posted at</span>
          </div>
          <div className="grid h-20 place-items-center text-sm text-muted">Chưa có backlink.</div>
        </div>
      </Panel>
    </AppShell>
  );
}
