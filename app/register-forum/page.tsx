import { CheckCircle2, ClipboardList, ExternalLink, SearchCheck, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AccountResultsTable } from "@/components/register-forum/account-results";
import { HideUrlButton } from "@/components/register-forum/hide-url-button";
import { BulkAutoRegisterButton, SyncRegistrationCandidatesButton } from "@/components/register-forum/registration-actions";
import { Panel } from "@/components/ui";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import type { RegistrationAccountRow, RegistrationJobRow, RegistrationUrlRow } from "@/lib/types/registration";

type Candidate = {
  id: string;
  domain: string;
  sourceUrl: string;
  registerUrl: string;
  cmsType: string;
  score: number;
  state: "url_verified" | "needs_probe" | "manual_review";
  reason: string;
  cachedStatus?: string;
};

const pipelineSteps = [
  {
    title: "Discover",
    caption: "Lay URL tu crawler, homepage va CMS pattern.",
    icon: ClipboardList,
  },
  {
    title: "Score",
    caption: "Uu tien register/signup, form email, password va submit.",
    icon: SearchCheck,
  },
  {
    title: "Verify",
    caption: "Probe toi da 3 URL/domain, chi pass khi co form that.",
    icon: CheckCircle2,
  },
  {
    title: "Cache",
    caption: "Luu domain, register_url, cms_type va lan verify gan nhat.",
    icon: ShieldCheck,
  },
];

const plannedStates = [
  ["discover", "Tim link dang ky"],
  ["url_verified", "Da co URL ung vien"],
  ["awaiting_email", "Cho email xac nhan"],
  ["click_verify", "Mo link verify"],
  ["set_password", "Dat mat khau sau verify"],
  ["active", "Tai khoan san sang"],
  ["manual_review", "Can review thu cong"],
];

export default async function RegisterForumPage() {
  const registrationData = await loadRegistrationData();
  const candidates = buildCandidates(registrationData.urls)
    .sort((a, b) => b.score - a.score);
  const readyCount = candidates.filter((item) => item.state === "url_verified").length;
  const pendingCount = candidates.filter((item) => item.state === "needs_probe").length;
  const checkCount = candidates.filter((item) => item.state === "manual_review").length;

  return (
    <AppShell title="Dang ky dien dan">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Pipeline dang ky tu dong</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Trang nay bien tai lieu Lovable thanh man hinh dieu phoi an toan: discover, score, verify va cache link dang ky
            truoc khi dua vao job review.
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          Tu dong dang ky bang Email Pool
        </div>
      </div>

      <div className="mt-7 grid gap-4 xl:grid-cols-4">
        {pipelineSteps.map((step) => {
          const Icon = step.icon;
          return (
            <Panel key={step.title} className="min-h-[132px]">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Icon size={18} />
                </div>
                <h2 className="text-base font-semibold">{step.title}</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">{step.caption}</p>
            </Panel>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Metric label="URL verified" value={readyCount} tone="green" />
        <Metric label="Chua kiem tra" value={pendingCount} tone="blue" />
        <Metric label="Can xem lai" value={checkCount + registrationData.jobs.length} tone="amber" />
      </div>

      <div className="mt-7 grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Ung vien dang ky ({candidates.length} URL)</h2>
              <p className="mt-1 text-sm text-muted">
                Chi hien thi URL da luu vao bang registration_urls. Bam Lay URL tu cot Register de nap moi.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <BulkAutoRegisterButton
                candidates={candidates.map((item) => ({
                  domain: item.domain,
                  registerUrl: item.registerUrl,
                  cmsType: item.cmsType,
                }))}
              />
              <SyncRegistrationCandidatesButton />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[minmax(260px,1.4fr)_110px_80px_124px_112px] gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-muted">
              <span>URL dang ky</span>
              <span>CMS</span>
              <span>Score</span>
              <span>State</span>
              <span className="text-center">Link</span>
            </div>
            {candidates.length ? (
              candidates.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(260px,1.4fr)_110px_80px_124px_112px] items-center gap-3 border-b border-border/70 px-3 py-3 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <a
                      href={item.registerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-sm font-medium text-cyan-300 hover:underline"
                      title={item.registerUrl}
                    >
                      {item.registerUrl}
                    </a>
                  </div>
                  <span className="text-muted">{item.cmsType}</span>
                  <span className="font-mono text-primary">{item.score}</span>
                  <StatusBadge state={item.state} />
                  <div className="flex items-center justify-center gap-2">
                    <a
                      href={item.registerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-white"
                      title={item.registerUrl}
                    >
                      <ExternalLink size={15} />
                    </a>
                    <HideUrlButton domain={item.domain} url={item.registerUrl} cmsType={item.cmsType} />
                  </div>
                </div>
              ))
            ) : (
              <div className="grid h-24 place-items-center px-3 text-sm text-muted">
                Chua co URL dang ky nao trong bang. Bam Lay URL tu cot Register de nap tu Crawler URL.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold">Job queue theo tai lieu</h2>
          <p className="mt-1 text-sm text-muted">
            Day la state map de implement tiep registration_jobs ma khong tron lan voi crawler hien tai.
          </p>
          <div className="mt-5 space-y-2">
            {plannedStates.map(([state, label]) => (
              <div key={state} className="flex items-center justify-between rounded-md border border-border bg-panel2 px-3 py-2">
                <span className="font-mono text-xs text-primary">{state}</span>
                <span className="text-sm text-muted">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-border">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-muted">
              Review queue ({registrationData.jobs.length})
            </div>
            {registrationData.jobs.length ? (
              registrationData.jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="border-b border-border/70 px-3 py-2 text-sm last:border-b-0">
                  <p className="truncate text-white">{job.domain}</p>
                  <p className="mt-1 truncate text-xs text-muted">{job.error_code ?? job.state}</p>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted">Chua co job review.</div>
            )}
          </div>
          <div className="mt-5 rounded-md border border-border bg-black/20 p-3 text-xs leading-5 text-muted">
            Enqueue that nen chi bat sau khi co bang site_profiles, registration_urls va worker probe form. Neu probe fail thi ghi
            no_register_form va chuyen review thu cong.
          </div>
        </Panel>
      </div>

      <Panel className="mt-7">
        <div>
          <h2 className="text-base font-semibold">Danh sach account da dang ky</h2>
        </div>
        <AccountResultsTable accounts={registrationData.accounts} error={registrationData.accountsError} />
      </Panel>
    </AppShell>
  );
}

async function loadRegistrationData(): Promise<{
  urls: RegistrationUrlRow[];
  jobs: RegistrationJobRow[];
  accounts: RegistrationAccountRow[];
  accountsError: string | null;
}> {
  const repository = new RegistrationRepository();
  const [urlsResult, jobsResult, accountsResult] = await Promise.allSettled([
    repository.listUrls(2000),
    repository.listJobs(50),
    repository.listAccounts(100),
  ]);
  return {
    urls: urlsResult.status === "fulfilled" ? urlsResult.value : [],
    jobs: jobsResult.status === "fulfilled" ? jobsResult.value : [],
    accounts: accountsResult.status === "fulfilled" ? accountsResult.value : [],
    accountsError: accountsResult.status === "fulfilled" ? null : mapRegistrationDataError(accountsResult.reason),
  };
}

function mapRegistrationDataError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  if (message.includes("schema cache") && message.includes("registration_accounts")) {
    return "Supabase schema cache chua thay registration_accounts. Hay chay: NOTIFY pgrst, 'reload schema'; trong SQL Editor, sau do reload trang.";
  }
  if (message.includes("registration_accounts")) {
    return "Chua doc duoc bang registration_accounts. Kiem tra migration 004_registration_accounts.sql.";
  }
  return message;
}

function cachedUrlToCandidate(row: RegistrationUrlRow): Candidate {
  return {
    id: row.id,
    domain: row.domain,
    sourceUrl: row.url,
    registerUrl: row.final_url ?? row.url,
    cmsType: row.cms_type,
    score: row.score,
    state: row.status === "verified" ? "url_verified" : row.status === "candidate" ? "needs_probe" : "manual_review",
    reason: typeof row.evidence.reason === "string" ? row.evidence.reason : row.failure_code ?? "Registration URL cache",
    cachedStatus: row.status,
  };
}

function buildCandidates(cachedUrls: RegistrationUrlRow[]) {
  const visibleCachedUrls = cachedUrls.filter((item) => item.status !== "blocked");
  const cachedCandidates = visibleCachedUrls.map(cachedUrlToCandidate);
  return uniqueCandidatesByRegisterUrl(cachedCandidates);
}

function uniqueCandidatesByRegisterUrl(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalizeUrlKey(candidate.registerUrl);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "amber" }) {
  const toneClass =
    tone === "green"
      ? "text-emerald-200 border-emerald-400/30 bg-emerald-500/10"
      : tone === "blue"
        ? "text-sky-200 border-sky-400/30 bg-sky-500/10"
        : "text-amber-100 border-amber-400/30 bg-amber-500/10";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ state }: { state: Candidate["state"] }) {
  const label = state === "url_verified" ? "ready" : state === "needs_probe" ? "pending" : "check";
  const className =
    state === "url_verified"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : state === "needs_probe"
        ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
        : "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}
