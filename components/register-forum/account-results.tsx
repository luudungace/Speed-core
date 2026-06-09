"use client";

import { useState } from "react";
import { Download, Eye, EyeOff } from "lucide-react";
import { Button, Select } from "@/components/ui";
import type { RegistrationAccountRow } from "@/lib/types/registration";

export function AccountResultsTable({ accounts, error }: { accounts: RegistrationAccountRow[]; error?: string | null }) {
  const [showPasswords, setShowPasswords] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function exportExcel() {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = accounts.map((account) => ({
        Domain: account.domain,
        "Login link": account.login_url,
        "Register URL": account.register_url ?? "",
        Email: account.account_email,
        Username: account.username ?? "",
        Password: account.password_value,
        Status: account.status,
        Notes: account.notes ?? "",
        "Created at": account.created_at,
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 24 },
        { wch: 42 },
        { wch: 42 },
        { wch: 28 },
        { wch: 20 },
        { wch: 24 },
        { wch: 18 },
        { wch: 32 },
        { wch: 24 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "registered_accounts");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `registered-accounts-${stamp}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div className="text-sm font-semibold text-muted">Ket qua account ({accounts.length})</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button className="h-8 px-2" variant="ghost" onClick={exportExcel} disabled={accounts.length === 0 || isExporting}>
            <Download size={14} />
            Luu Excel
          </Button>
          <Button className="h-8 px-2" variant="ghost" onClick={() => setShowPasswords((value) => !value)}>
            {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPasswords ? "An pass" : "Hien pass"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1.25fr_1fr_0.8fr_0.8fr_100px_1.35fr] border-b border-border px-3 py-3 text-sm font-semibold text-muted">
        <span>Domain</span>
        <span>Login link</span>
        <span>Email</span>
        <span>Username</span>
        <span>Password</span>
        <span>Status</span>
        <span>Notes</span>
      </div>
      {error ? (
        <div className="px-3 py-4 text-sm leading-6 text-red-300">{error}</div>
      ) : accounts.length ? (
        accounts.map((account) => (
          <div
            key={account.id}
            className="grid grid-cols-[1fr_1.25fr_1fr_0.8fr_0.8fr_100px_1.35fr] items-center gap-2 border-b border-border/70 px-3 py-3 text-sm last:border-b-0"
          >
            <span className="truncate font-medium text-white">{account.domain}</span>
            <a className="truncate text-primary hover:underline" href={account.login_url} target="_blank" rel="noreferrer">
              {account.login_url}
            </a>
            <span className="truncate text-muted">{account.account_email}</span>
            <span className="truncate text-muted">{account.username ?? "-"}</span>
            <span className="truncate font-mono text-muted">
              {account.password_value === "-" ? "-" : showPasswords ? account.password_value : "••••••••"}
            </span>
            <Select value={account.status} disabled className="h-8">
              <option value="manual_saved">Manual</option>
              <option value="active">Active</option>
              <option value="needs_verification">Verify</option>
              <option value="failed">Failed</option>
            </Select>
            <span className={account.status === "failed" ? "truncate text-red-300" : "truncate text-muted"} title={account.notes ?? ""}>
              {account.notes ?? "-"}
            </span>
          </div>
        ))
      ) : (
        <div className="grid h-20 place-items-center px-3 text-sm text-muted">Chua co ket qua account.</div>
      )}
    </div>
  );
}
