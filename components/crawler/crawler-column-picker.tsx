"use client";

import { useEffect, useRef, useState } from "react";
import { Columns2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  defaultVisibleColumnIds,
  visibleCrawlerResultColumns,
  type CrawlerResultColumnId,
} from "@/lib/utils/crawler-result-columns";

type CrawlerColumnPickerProps = {
  visibleColumns: Set<CrawlerResultColumnId>;
  onChange: (columns: Set<CrawlerResultColumnId>) => void;
};

export function CrawlerColumnPicker({ visibleColumns, onChange }: CrawlerColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggleColumn(id: CrawlerResultColumnId, locked?: boolean) {
    if (locked) return;
    const next = new Set(visibleColumns);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!next.has("url")) next.add("url");
    onChange(next);
  }

  function resetDefaults() {
    onChange(new Set(defaultVisibleColumnIds()));
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        title="Cấu hình cột hiển thị"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Columns2 size={16} />
        Cột
      </Button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-[#0b111b] p-3 shadow-lg">
          <div className="mb-2 text-xs font-semibold text-muted">Hiển thị cột</div>
          <div className="space-y-2">
            {visibleCrawlerResultColumns().map((column) => (
              <label
                key={column.id}
                className={`flex cursor-pointer items-center gap-2 text-sm ${column.locked ? "text-muted" : "text-white"}`}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={visibleColumns.has(column.id)}
                  disabled={column.locked}
                  onChange={() => toggleColumn(column.id, column.locked)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          <Button type="button" variant="ghost" className="mt-3 h-8 w-full px-2 text-xs" onClick={resetDefaults}>
            Mặc định
          </Button>
        </div>
      ) : null}
    </div>
  );
}
