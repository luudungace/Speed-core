import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = createSupabaseAdmin();

    // 1. Crawl Jobs Count
    const { count: crawlJobsCount, error: err1 } = await db
      .from("crawl_jobs")
      .select("*", { count: "exact", head: true });
    if (err1) throw err1;

    // 2. Crawl Results Count (URL đã cào)
    const { count: crawledUrlsCount, error: err2 } = await db
      .from("crawl_results")
      .select("*", { count: "exact", head: true });
    if (err2) throw err2;

    // 3. Registration Success / Total
    const { count: regJobsCount, error: err3 } = await db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true });
    if (err3) throw err3;

    // 3a. Count standard registration jobs (requires registration)
    const { count: regJobsRegisterCount, error: errReg1 } = await db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true })
      .is("username", null);
    if (errReg1) throw errReg1;

    // 3b. Count direct posting jobs (pre-owned accounts)
    const { count: regJobsDirectCount, error: errReg2 } = await db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true })
      .not("username", "is", null);
    if (errReg2) throw errReg2;

    const { count: regSuccessCount, error: err4 } = await db
      .from("registration_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");
    if (err4) throw err4;

    const registrationSuccessRate = regJobsCount && regJobsCount > 0
      ? `${Math.round((Number(regSuccessCount) / Number(regJobsCount)) * 100)}%`
      : "0%";

    // 4. Posted Backlinks Count
    const { count: backlinksCount, error: err5 } = await db
      .from("posted_backlinks")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");
    if (err5) throw err5;

    // 5. Emails Pool (available / total)
    const { count: emailsTotalCount, error: err6 } = await db
      .from("emails")
      .select("*", { count: "exact", head: true });
    if (err6) throw err6;

    const { count: emailsAvailableCount, error: err7 } = await db
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("status", "available");
    if (err7) throw err7;

    const emailsRatio = `${emailsAvailableCount ?? 0}/${emailsTotalCount ?? 0}`;

    // 6. Proxy Count
    const { count: proxiesCount, error: err8 } = await db
      .from("proxies")
      .select("*", { count: "exact", head: true });
    if (err8) throw err8;

    return NextResponse.json({
      crawlJobs: String(crawlJobsCount ?? 0),
      crawledUrls: String(crawledUrlsCount ?? 0),
      registrationRate: registrationSuccessRate,
      backlinksPosted: String(backlinksCount ?? 0),
      emailsRatio,
      proxiesCount: String(proxiesCount ?? 0),
      registrationJobsRegister: String(regJobsRegisterCount ?? 0),
      registrationJobsDirect: String(regJobsDirectCount ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If table doesn't exist yet, gracefully return zeros instead of breaking the UI
    return NextResponse.json({
      crawlJobs: "0",
      crawledUrls: "0",
      registrationRate: "0%",
      backlinksPosted: "0",
      emailsRatio: "0/0",
      proxiesCount: "0",
      registrationJobsRegister: "0",
      registrationJobsDirect: "0",
      error: msg,
    });
  }
}
