Mục tiêu:
Hoàn thiện khoảng 99% Phase 1 + Phase 2:
- Phase 1: database migrations + repository + project/competitor CRUD.
- Phase 2: opportunity runner + dashboard lấy backlink competitor, crawl source, chấm điểm, lưu và hiển thị.

Tính năng cần có:

1. Database migration
Tạo migration mới trong supabase/migrations, ví dụ:
supabase/migrations/003_backlink_opportunities.sql

Tạo các bảng:

backlink_projects:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- name text not null
- my_domain text not null

backlink_project_competitors:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- project_id uuid not null references backlink_projects(id) on delete cascade
- domain text not null
- unique(project_id, domain)

backlink_opportunity_jobs:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- project_id uuid not null references backlink_projects(id) on delete cascade
- status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled'))
- total_sources integer not null default 0
- processed_sources integer not null default 0
- success_count integer not null default 0
- failed_count integer not null default 0
- error text null
- metadata jsonb not null default '{}'::jsonb

backlink_opportunity_job_logs:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- job_id uuid not null references backlink_opportunity_jobs(id) on delete cascade
- level text not null default 'info' check (level in ('info','warn','error'))
- message text not null
- payload jsonb not null default '{}'::jsonb

backlink_source_links:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- project_id uuid not null references backlink_projects(id) on delete cascade
- competitor_domain text not null
- source_url text not null
- source_domain text not null
- target_url text
- is_active boolean
- first_seen timestamptz null
- last_seen timestamptz null
- raw_data jsonb not null default '{}'::jsonb
- unique(project_id, competitor_domain, source_url)

backlink_opportunities:
- id uuid primary key default gen_random_uuid()
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- project_id uuid not null references backlink_projects(id) on delete cascade
- job_id uuid null references backlink_opportunity_jobs(id) on delete set null
- source_url text not null
- source_domain text not null
- title text
- cms_type text not null default 'Unknown'
- site_type text not null default 'Unknown'
- score integer not null default 0
- competitor_count integer not null default 0
- competitors text[] not null default '{}'
- registration_urls jsonb not null default '[]'::jsonb
- login_urls jsonb not null default '[]'::jsonb
- submit_urls jsonb not null default '[]'::jsonb
- profile_urls jsonb not null default '[]'::jsonb
- emails jsonb not null default '[]'::jsonb
- phones jsonb not null default '[]'::jsonb
- crawl_status text not null default 'pending' check (crawl_status in ('pending','success','failed'))
- error text
- crawl_time double precision not null default 0
- html_snippet text
- raw_candidate jsonb not null default '{}'::jsonb
- raw_crawl_data jsonb not null default '{}'::jsonb
- last_crawled_at timestamptz
- unique(project_id, source_url)

Indexes:
- backlink_project_competitors(project_id)
- backlink_source_links(project_id)
- backlink_source_links(project_id, source_domain)
- backlink_source_links(project_id, competitor_domain)
- backlink_opportunities(project_id)
- backlink_opportunities(project_id, score desc)
- backlink_opportunities(project_id, competitor_count desc)
- backlink_opportunity_jobs(project_id)
- backlink_opportunity_job_logs(job_id, created_at desc)

Enable RLS cho tất cả bảng và tạo service_role policies giống style migration crawler hiện tại.

2. Type definitions
Tạo file:
lib/types/backlink-opportunity.ts

Định nghĩa:
- BacklinkProjectRow
- BacklinkProjectCompetitorRow
- BacklinkOpportunityJobStatus
- BacklinkOpportunityJobRow
- BacklinkOpportunityJobLogRow
- BacklinkSourceLinkRow
- BacklinkOpportunityRow
- BacklinkOpportunityFilters
- CreateBacklinkProjectInput
- StartBacklinkOpportunityJobInput

Các type phải tương thích Supabase rows và UI.

3. Utility normalize domain
Tạo hoặc reuse helper domain:
lib/utils/domain.ts

Hàm cần có:
- normalizeDomain(input: string): string
  - trim
  - lowercase
  - remove http/https
  - remove www.
  - remove path/query/hash
  - validate có dấu chấm
- getDomainFromUrl(url: string): string
  - dùng URL parser
  - remove www.
- normalizeDomainList(input: string, max?: number): string[]

Có thể refactor nhẹ những chỗ đang normalize domain thủ công, nhưng không bắt buộc nếu có rủi ro.

4. Repository
Tạo:
lib/repositories/backlink-opportunity-repository.ts

Các method cần có:

Project:
- createProject(input: { name: string; myDomain: string; competitors: string[] }): Promise<BacklinkProjectRow>
- updateProject(id, input)
- getProject(id): Promise<BacklinkProjectRow | null>
- listProjects(): Promise<BacklinkProjectRow[]>
- deleteProject(id): Promise<void>
- replaceCompetitors(projectId, competitors): Promise<void>
- listCompetitors(projectId): Promise<BacklinkProjectCompetitorRow[]>

Jobs:
- createJob(projectId, metadata?): Promise<BacklinkOpportunityJobRow>
- updateJob(id, patch): Promise<void>
- getJob(id): Promise<BacklinkOpportunityJobRow | null>
- listJobs(projectId, limit?): Promise<BacklinkOpportunityJobRow[]>
- addLog(jobId, message, level?, payload?): Promise<void>
- getJobLogs(jobId): Promise<BacklinkOpportunityJobLogRow[]>

Sources:
- upsertSourceLink(input): Promise<void>
- listSourceLinksForProject(projectId): Promise<BacklinkSourceLinkRow[]>
- getUniqueSourceUrls(projectId): Promise<string[]>

Opportunities:
- upsertOpportunity(input): Promise<void>
- listOpportunities(params): Promise<{ rows: BacklinkOpportunityRow[]; count: number }>
- getOpportunity(id): Promise<BacklinkOpportunityRow | null>
- deleteOpportunities(ids): Promise<void>

listOpportunities filters:
- projectId required
- search optional: source_url/source_domain/title
- siteType optional
- cmsType optional
- minScore optional
- minCompetitorCount optional
- hasRegistration optional boolean
- hasSubmit optional boolean
- hasProfile optional boolean
- page/pageSize
- sort:
  - default competitor_count desc, score desc, created_at desc

Nếu Supabase query khó với jsonb length, có thể filter hasRegistration/hasSubmit/hasProfile trong memory với batch limit 2000, giống pattern CrawlerRepository đang có.

5. Opportunity runner
Tạo:
lib/services/backlink-opportunity-runner.ts

Hàm:
runBacklinkOpportunityJob(jobId: string): Promise<void>

Luồng:
- Load job + project + competitors.
- Nếu job cancelled thì return.
- Update job status running.
- Log bắt đầu.
- Với từng competitor:
  - gọi BacklinksShService.findSources(competitor, limitPerCompetitor, excludeDomains)
  - limit lấy từ job.metadata.source_limit, default 100
  - excludeDomains gồm my_domain và optional metadata.exclude_domains
  - Lưu từng source vào backlink_source_links.
  - Raw data từ result.raw.
- Sau khi fetch xong:
  - gom unique source_url.
  - update total_sources.
  - Log số source unique và số competitor.
- Với từng source_url:
  - kiểm tra cancelled.
  - crawl bằng PlaywrightCrawlerService.crawl với SerperResult tương ứng.
  - lấy candidate từ getBacklinkCandidateFromRaw(result.raw_serper_data)
  - tính competitor_count bằng số competitor_domain khác nhau trong backlink_source_links có cùng source_url hoặc source_domain.
  - competitors là array competitor domains.
  - upsert backlink_opportunities:
    - source_url
    - source_domain
    - title
    - cms_type
    - site_type
    - score
    - competitor_count
    - competitors
    - registration_urls/login_urls/submit_urls/profile_urls
    - emails/phones
    - crawl_status
    - error
    - crawl_time
    - html_snippet
    - raw_candidate
    - raw_crawl_data
    - last_crawled_at
  - update processed/success/failed count.
  - log OK/FAIL.
- Khi xong update completed.
- On error update failed + log error.
- finally close Playwright crawler.

Lưu ý:
- Không dùng direct write ngoài repository.
- Không phá CrawlerRepository.
- Nên dedupe bằng source_url, nhưng competitor_count phải bảo toàn quan hệ nhiều competitor.
- Nếu candidate null thì score 0, site_type Unknown.
- Nếu crawl failed vẫn lưu opportunity với crawl_status failed để người dùng thấy.

6. Server actions
Tạo:
app/backlink-opportunities/actions.ts

Actions:
- createBacklinkProjectAction(input: { name: string; myDomain: string; competitors: string })
  - normalize competitors từ textarea
  - validate 3-10 competitors
  - validate myDomain
- updateBacklinkProjectAction(...)
- deleteBacklinkProjectAction(projectId)
- startBacklinkOpportunityJobAction(input: { projectId: string; sourceLimit?: number; excludeDomains?: string })
  - create job
  - metadata gồm source_limit, exclude_domains
  - void runBacklinkOpportunityJob(job.id)
  - return jobId
- cancelBacklinkOpportunityJobAction(jobId)
- deleteBacklinkOpportunitiesAction(ids)

7. API routes
Tạo:
- app/api/backlink-opportunities/projects/route.ts
  - GET list projects
- app/api/backlink-opportunities/projects/[projectId]/route.ts
  - GET project + competitors + recent jobs
- app/api/backlink-opportunities/jobs/[jobId]/route.ts
  - GET job + logs
- app/api/backlink-opportunities/results/route.ts
  - GET list opportunities with filters
  - DELETE delete opportunities
- app/api/backlink-opportunities/export/route.ts
  - export XLSX opportunities theo filter

Có thể dùng xlsx package đã có trong project.
Export columns:
- source_url
- source_domain
- title
- cms_type
- site_type
- score
- competitor_count
- competitors
- registration_urls
- submit_urls
- profile_urls
- emails
- phones
- crawl_status
- error
- last_crawled_at

8. UI page
Tạo:
app/backlink-opportunities/page.tsx

Server component:
- load initial projects nếu cần
- render BacklinkOpportunityClient

Tạo:
components/backlink-opportunities/backlink-opportunity-client.tsx

UI yêu cầu:
- Không landing page.
- Màn hình chính là dashboard vận hành.
- Layout:
  - Top panel: Project selector + create project form.
  - Project form:
    - tên project
    - my domain
    - competitors textarea
    - source limit per competitor
    - exclude domains textarea optional
    - button “Lưu project”
    - button “Chạy phân tích”
    - button “Dừng”
  - Job status panel:
    - status
    - processed/total
    - success/failed
    - live logs
  - Results panel:
    - search
    - site type select
    - CMS select
    - min score input
    - min competitor count input
    - checkboxes/toggles: có register, có submit, có profile
    - export XLSX
    - refresh
  - Table columns:
    - source URL
    - domain
    - score
    - competitor count
    - competitors
    - site type
    - CMS
    - register/submit/profile indicators
    - emails
    - status
    - last crawled
    - open external URL
- Sort mặc định backend: competitor_count desc, score desc.
- Poll job mỗi 1800-2500ms khi job running/queued, giống crawler-url-client.
- Persist selected projectId/filter basic vào localStorage nếu thuận tiện.
- Dùng components/ui.tsx có sẵn.
- Dùng lucide-react icons.
- Table responsive overflow-x.
- Không card lồng card.
- Text tiếng Việt có dấu chuẩn UTF-8.

9. Navigation
Nếu app có shell/nav, thêm link “Backlink Opportunities” hoặc “Cơ hội Backlink”.
Kiểm tra components/app-shell.tsx hoặc page chính để thêm route phù hợp.

10. Validation/error handling
- Nếu thiếu BACKLINKS_SH_API_KEY: hiển thị lỗi rõ.
- Nếu Supabase thiếu bảng: trả thông báo yêu cầu chạy migration.
- Nếu competitor < 3 hoặc > 10: báo lỗi.
- Nếu myDomain trùng competitor: loại hoặc báo lỗi.
- Không crash UI khi job failed.
- Các action trả object `{ ok: true }` hoặc `{ ok: false, error }` theo style hiện có.

11. Verification
Sau khi code:
- Chạy `npm run typecheck`.
- Nếu có lint script hoạt động thì chạy `npm run lint`, nhưng nếu Next lint config lỗi sẵn thì ghi rõ.
- Không tự ý sửa dữ liệu `.data/email-pool.json` hoặc thay đổi unrelated files.
- Không revert thay đổi của user.
- Final response tóm tắt file chính đã thêm/sửa và kết quả kiểm tra.

Acceptance criteria:
- Có thể vào /backlink-opportunities.
- Tạo project với my_domain + 3-10 competitors.
- Chạy phân tích backlink opportunity.
- Job lấy sources từ backlinks.sh, crawl từng source bằng Playwright.
- Kết quả được lưu vào backlink_opportunities.
- Dashboard hiển thị score, site_type, CMS, competitor_count, register/submit/profile URLs, emails.
- Có filter/search/export.
- TypeScript pass.