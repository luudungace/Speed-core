"use client";

import { useState } from "react";
import { Upload, Unlock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";

const tabs = ["Email Pool", "Proxy", "Persona"];

export default function ResourcesPage() {
  const [tab, setTab] = useState("Email Pool");

  return (
    <AppShell title="Tài nguyên">
      <h1 className="text-2xl font-semibold tracking-normal">Quản lý tài nguyên</h1>
      <p className="mt-1 text-sm text-muted">Kho dùng chung: Email, Proxy, Persona. Worker tự động khoá/mở khoá khi sử dụng.</p>
      <div className="mt-7 inline-flex rounded-md bg-[#162130] p-1">
        {tabs.map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`rounded px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-[#070c14] text-white" : "text-muted"}`}>
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
              <Textarea className="mt-7 h-44 w-full" defaultValue={"user@outlook.com|abc123\nuser2@gmail.com|xyz456"} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div><label className="mb-1 block text-sm font-semibold">IMAP host</label><Input defaultValue="imap.gmail.com" className="w-full" /></div>
                <div><label className="mb-1 block text-sm font-semibold">Port</label><Input defaultValue="993" className="w-full" /></div>
              </div>
              <div className="mt-3 flex gap-2"><Button><Upload size={16} />Nạp</Button><Button variant="ghost"><Unlock size={16} />Mở khoá kẹt</Button></div>
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
          <h2 className="text-base font-semibold">{tab === "Email Pool" ? "Email pool" : tab === "Proxy" ? "Proxy pool" : "Personas"} (0)</h2>
          <div className="mt-6 rounded-md border border-border">
            <div className="grid grid-cols-3 border-b border-border px-3 py-3 text-sm font-semibold text-muted">
              <span>{tab === "Email Pool" ? "Email" : tab === "Proxy" ? "Endpoint" : "Name"}</span><span>{tab === "Email Pool" ? "IMAP" : tab === "Proxy" ? "Type" : "Username"}</span><span>Status</span>
            </div>
            <div className="grid h-20 place-items-center text-sm text-muted">Chưa có {tab === "Email Pool" ? "email" : tab === "Proxy" ? "proxy" : "persona"}.</div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
