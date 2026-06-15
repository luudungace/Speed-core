import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrawlJobRow } from "@/lib/types/crawler";
import type { RegistrationJobRow } from "@/lib/types/registration";
import { getBacklinkCandidateFromRaw } from "@/lib/utils/backlink-candidate";

export type DashboardStats = {
  fetchedAt: string;
  crawl: {
    jobsTotal: number;
    jobsRunning: number;
    jobsQueued: number;
    jobsCompleted: number;
    jobsFailed: number;
    urlsTotal: number;
    urlsSuccess: number;
    urlsFailed: number;
    manualReview: number;
    avgCrawlTimeSec: number;
    cmsBreakdown: { cms: string; count: number }[];
    candidateRatings: { label: string; count: number }[];
    recentJobs: CrawlJobRow[];
  };
  registration: {
    jobsTotal: number;
    queued: number;
    processing: number;
    success: number;
    failed: number;
    cancelled: number;
    registeredAccounts: number;
    successRate: number;
    avgLifecycleMin: number;
    recentJobs: RegistrationJobRow[];
  };
  backlinks: {
    postedTotal: number;
    postedAlive: number;
    postedDead: number;
    opportunitiesTotal: number;
    projectsTotal: number;
    opportunityJobsRunning: number;
    recentPosted: Array<{
      id: string;
      forum_url: string;
      posted_url: string;
      status: string;
      posted_at: string;
      is_alive: boolean | null;
    }>;
  };
  discovery: {
    dorkProjects: number;
    dorkJobsRunning: number;
    discoveredForums: number;
    forumsImported: number;
  };
  resources: {
    emailsTotal: number;
    emailsAvailable: number;
    emailsLocked: number;
    proxiesTotal: number;
    proxiesAvailable: number;
    proxiesDead: number;
    personasTotal: number;
  };
};

type CountQuery = ReturnType<ReturnType<ReturnType<typeof createSupabaseAdmin>["from"]>["select"]>;

async function countWhere(table: string, apply?: (query: CountQuery) => CountQuery) {
  const db = createSupabaseAdmin();
  const query = apply
    ? apply(db.from(table).select("*", { count: "exact", head: true }))
    : db.from(table).select("*", { count: "exact", head: true });
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function candidateRatingLabel(score: number, evidence: string[]) {
  const hasForumPostingUrl = evidence.includes("forum posting URL found");
  if (hasForumPostingUrl && score >= 70) return "Ngon";
  if (score >= 55) return "Có tiềm năng";
  if (score >= 30) return "Xem xét";
  return "Không có tiềm năng";
}

function average(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = createSupabaseAdmin();

  const [
    jobsTotal,
    jobsRunning,
    jobsQueued,
    jobsCompleted,
    jobsFailed,
    urlsTotal,
    urlsSuccess,
    urlsFailed,
    manualReview,
    regTotal,
    regQueued,
    regProcessing,
    regSuccess,
    regFailed,
    regCancelled,
    registeredAccounts,
    postedTotal,
    postedAlive,
    opportunitiesTotal,
    backlinkProjects,
    opportunityJobsRunning,
    dorkProjects,
    dorkJobsRunning,
    discoveredForums,
    forumsImported,
    emailsTotal,
    emailsAvailable,
    emailsLocked,
    proxiesTotal,
    proxiesAvailable,
    proxiesDead,
    personasTotal,
    recentCrawlJobsRes,
    recentRegJobsRes,
    recentPostedRes,
    successJobsRes,
    crawlTimeRes,
    cmsRowsRes,
    candidateSampleRes,
  ] = await Promise.all([
    countWhere("crawl_jobs"),
    countWhere("crawl_jobs", (q) => q.eq("status", "running")),
    countWhere("crawl_jobs", (q) => q.eq("status", "queued")),
    countWhere("crawl_jobs", (q) => q.eq("status", "completed")),
    countWhere("crawl_jobs", (q) => q.eq("status", "failed")),
    countWhere("crawl_results"),
    countWhere("crawl_results", (q) => q.eq("status", "success")),
    countWhere("crawl_results", (q) => q.eq("status", "failed")),
    countWhere("crawl_results", (q) => q.eq("status", "failed").ilike("error", "NEEDS_MANUAL_REVIEW:%")),
    countWhere("registration_jobs"),
    countWhere("registration_jobs", (q) => q.eq("status", "queued")),
    countWhere("registration_jobs", (q) => q.eq("status", "processing")),
    countWhere("registration_jobs", (q) => q.eq("status", "success")),
    countWhere("registration_jobs", (q) => q.eq("status", "failed")),
    countWhere("registration_jobs", (q) => q.eq("status", "cancelled")),
    countWhere("registration_jobs", (q) => q.not("username", "is", null).not("password", "is", null)),
    countWhere("posted_backlinks"),
    countWhere("posted_backlinks", (q) => q.eq("is_alive", true)),
    countWhere("backlink_opportunities"),
    countWhere("backlink_projects"),
    countWhere("backlink_opportunity_jobs", (q) => q.eq("status", "running")),
    countWhere("dork_projects"),
    countWhere("dork_jobs", (q) => q.eq("status", "running")),
    countWhere("discovered_forums"),
    countWhere("discovered_forums", (q) => q.eq("status", "imported")),
    countWhere("emails"),
    countWhere("emails", (q) => q.eq("status", "available")),
    countWhere("emails", (q) => q.eq("status", "locked")),
    countWhere("proxies"),
    countWhere("proxies", (q) => q.eq("status", "available")),
    countWhere("proxies", (q) => q.eq("status", "dead")),
    countWhere("personas"),
    db.from("crawl_jobs").select("*").order("created_at", { ascending: false }).limit(5),
    db.from("registration_jobs").select("*").order("updated_at", { ascending: false }).limit(6),
    db
      .from("posted_backlinks")
      .select("id, forum_url, posted_url, status, posted_at, is_alive")
      .order("posted_at", { ascending: false })
      .limit(5),
    db
      .from("registration_jobs")
      .select("created_at, updated_at")
      .eq("status", "success")
      .order("updated_at", { ascending: false })
      .limit(200),
    db.from("crawl_results").select("crawl_time").eq("status", "success").order("created_at", { ascending: false }).limit(300),
    db.from("crawl_results").select("cms_type").eq("status", "success").order("created_at", { ascending: false }).limit(2000),
    db
      .from("crawl_results")
      .select("raw_serper_data")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const terminalReg = regSuccess + regFailed;
  const successRate = terminalReg > 0 ? Math.round((regSuccess / terminalReg) * 1000) / 10 : 0;

  const lifecycleMinutes = (successJobsRes.data ?? [])
    .map((row) => {
      const start = new Date(row.created_at as string).getTime();
      const end = new Date(row.updated_at as string).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return (end - start) / 60_000;
    })
    .filter((value): value is number => value !== null);

  const cmsMap = new Map<string, number>();
  for (const row of cmsRowsRes.data ?? []) {
    const cms = (row.cms_type as string) || "Unknown";
    cmsMap.set(cms, (cmsMap.get(cms) ?? 0) + 1);
  }
  const cmsBreakdown = [...cmsMap.entries()]
    .map(([cms, count]) => ({ cms, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const ratingMap = new Map<string, number>([
    ["Ngon", 0],
    ["Có tiềm năng", 0],
    ["Xem xét", 0],
    ["Không có tiềm năng", 0],
  ]);
  for (const row of candidateSampleRes.data ?? []) {
    const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data as Record<string, unknown>);
    if (!candidate) continue;
    const label = candidateRatingLabel(candidate.score, candidate.evidence);
    ratingMap.set(label, (ratingMap.get(label) ?? 0) + 1);
  }
  const candidateRatings = [...ratingMap.entries()].map(([label, count]) => ({ label, count }));

  const crawlTimes = (crawlTimeRes.data ?? [])
    .map((row) => Number(row.crawl_time))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    fetchedAt: new Date().toISOString(),
    crawl: {
      jobsTotal,
      jobsRunning,
      jobsQueued,
      jobsCompleted,
      jobsFailed,
      urlsTotal,
      urlsSuccess,
      urlsFailed,
      manualReview,
      avgCrawlTimeSec: Math.round(average(crawlTimes) * 10) / 10,
      cmsBreakdown,
      candidateRatings,
      recentJobs: (recentCrawlJobsRes.data ?? []) as CrawlJobRow[],
    },
    registration: {
      jobsTotal: regTotal,
      queued: regQueued,
      processing: regProcessing,
      success: regSuccess,
      failed: regFailed,
      cancelled: regCancelled,
      registeredAccounts,
      successRate,
      avgLifecycleMin: Math.round(average(lifecycleMinutes) * 10) / 10,
      recentJobs: (recentRegJobsRes.data ?? []) as RegistrationJobRow[],
    },
    backlinks: {
      postedTotal,
      postedAlive,
      postedDead: Math.max(0, postedTotal - postedAlive),
      opportunitiesTotal,
      projectsTotal: backlinkProjects,
      opportunityJobsRunning,
      recentPosted: recentPostedRes.data ?? [],
    },
    discovery: {
      dorkProjects,
      dorkJobsRunning,
      discoveredForums,
      forumsImported,
    },
    resources: {
      emailsTotal,
      emailsAvailable,
      emailsLocked,
      proxiesTotal,
      proxiesAvailable,
      proxiesDead,
      personasTotal,
    },
  };
}

export type DashboardStatsSafe = DashboardStats & { loadError: string | null };

const EMPTY_STATS: DashboardStats = {
  fetchedAt: new Date().toISOString(),
  crawl: {
    jobsTotal: 0,
    jobsRunning: 0,
    jobsQueued: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    urlsTotal: 0,
    urlsSuccess: 0,
    urlsFailed: 0,
    manualReview: 0,
    avgCrawlTimeSec: 0,
    cmsBreakdown: [],
    candidateRatings: [],
    recentJobs: [],
  },
  registration: {
    jobsTotal: 0,
    queued: 0,
    processing: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
    registeredAccounts: 0,
    successRate: 0,
    avgLifecycleMin: 0,
    recentJobs: [],
  },
  backlinks: {
    postedTotal: 0,
    postedAlive: 0,
    postedDead: 0,
    opportunitiesTotal: 0,
    projectsTotal: 0,
    opportunityJobsRunning: 0,
    recentPosted: [],
  },
  discovery: {
    dorkProjects: 0,
    dorkJobsRunning: 0,
    discoveredForums: 0,
    forumsImported: 0,
  },
  resources: {
    emailsTotal: 0,
    emailsAvailable: 0,
    emailsLocked: 0,
    proxiesTotal: 0,
    proxiesAvailable: 0,
    proxiesDead: 0,
    personasTotal: 0,
  },
};

export async function getDashboardStatsSafe(): Promise<DashboardStatsSafe> {
  try {
    const stats = await getDashboardStats();
    return { ...stats, loadError: null };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      ...EMPTY_STATS,
      fetchedAt: new Date().toISOString(),
      loadError: error instanceof Error ? error.message : "Không tải được dữ liệu tổng quan.",
    };
  }
}
