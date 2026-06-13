import type { ContactItem } from "@/lib/types/crawler";

export const CRAWLER_RESULT_COLUMN_STORAGE_KEY = "speed-core.crawler-result-columns";

export type CrawlerResultColumnId = "url" | "domain" | "rating" | "siteType" | "cms" | "emails" | "phones" | "status";

export type CrawlerResultColumnDef = {
  id: CrawlerResultColumnId;
  label: string;
  defaultVisible: boolean;
  locked?: boolean;
  /** Tạm ẩn khỏi bảng và column picker */
  hidden?: boolean;
};

export const CRAWLER_RESULT_COLUMNS: CrawlerResultColumnDef[] = [
  { id: "url", label: "URL", defaultVisible: true, locked: true },
  { id: "domain", label: "Domain", defaultVisible: true },
  { id: "rating", label: "Đánh giá", defaultVisible: true },
  { id: "siteType", label: "Loại trang", defaultVisible: true },
  { id: "cms", label: "CMS", defaultVisible: true },
  { id: "emails", label: "Emails", defaultVisible: true },
  { id: "phones", label: "SĐT", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: false, hidden: true },
];

export function visibleCrawlerResultColumns() {
  return CRAWLER_RESULT_COLUMNS.filter((column) => !column.hidden);
}

export function defaultVisibleColumnIds(): CrawlerResultColumnId[] {
  return CRAWLER_RESULT_COLUMNS.filter((column) => column.defaultVisible && !column.hidden).map((column) => column.id);
}

export function parseStoredVisibleColumns(raw: string | null): CrawlerResultColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(CRAWLER_RESULT_COLUMNS.map((column) => column.id));
    const hidden = new Set(CRAWLER_RESULT_COLUMNS.filter((column) => column.hidden).map((column) => column.id));
    const ids = parsed
      .filter((id): id is CrawlerResultColumnId => typeof id === "string" && allowed.has(id as CrawlerResultColumnId))
      .filter((id) => !hidden.has(id));
    if (!ids.includes("url")) ids.unshift("url");
    for (const column of CRAWLER_RESULT_COLUMNS) {
      if (column.defaultVisible && !column.hidden && !ids.includes(column.id)) ids.push(column.id);
    }
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function contactValues(items: ContactItem[] | null | undefined) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item.value).filter(Boolean).join(", ");
}
