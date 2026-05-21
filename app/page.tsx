import { Database, FileText, Mail, Search, Server, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";

const cards = [
  ["Crawl jobs", "0", Search],
  ["URL đã cào", "0", Server],
  ["Tỷ lệ đăng ký thành công", "0%", ListChecks],
  ["Backlink đã đăng", "0", FileText],
  ["Email available / total", "0/0", Mail],
  ["Proxy trong kho", "0", Database],
  ["Registration jobs", "0", ListChecks],
];

export default function HomePage() {
  return (
    <AppShell title="Tổng quan">
      <h1 className="text-2xl font-semibold tracking-normal">Tổng quan vận hành</h1>
      <p className="mt-1 text-sm text-muted">Mục tiêu: tỷ lệ đăng ký thành công &gt; 40%, mỗi vòng đời &lt; 10 phút.</p>
      <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <Panel key={label as string} className="h-28">
            <div className="flex items-start justify-between">
              <div className="text-xs text-muted">{label as string}</div>
              <Icon className="text-muted" size={17} />
            </div>
            <div className="mt-4 text-2xl font-semibold">{value as string}</div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
