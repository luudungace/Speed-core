"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Download,
  ExternalLink,
  Trash2,
  Plus,
  Edit,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";
import {
  createBacklinkProjectAction,
  updateBacklinkProjectAction,
  deleteBacklinkProjectAction,
  startBacklinkOpportunityJobAction,
  cancelBacklinkOpportunityJobAction,
  deleteBacklinkOpportunitiesAction,
} from "@/app/backlink-opportunities/actions";
import type {
  BacklinkProjectRow,
  BacklinkOpportunityJobRow,
  BacklinkOpportunityJobLogRow,
  BacklinkOpportunityRow,
} from "@/lib/types/backlink-opportunity";

const SITE_TYPE_OPTIONS = ["All", "Forum", "Social", "Web 2.0", "Article", "Directory", "File", "Unknown"];
const CMS_OPTIONS = ["All", "XenForo", "WordPress", "vBulletin", "phpBB", "Unknown"];

export function BacklinkOpportunityClient() {
  const [isPending, startTransition] = useTransition();

  // Project state
  const [projects, setProjects] = useState<BacklinkProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectDetail, setProjectDetail] = useState<{
    project: BacklinkProjectRow;
    competitors: string[];
    recentJobs: BacklinkOpportunityJobRow[];
  } | null>(null);

  // Form state (Project Create/Edit)
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formMyDomain, setFormMyDomain] = useState("");
  const [formCompetitors, setFormCompetitors] = useState("");
  const [formError, setFormError] = useState("");

  // Job analysis launch form state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchSourceLimit, setLaunchSourceLimit] = useState(100);
  const [launchExcludeDomains, setLaunchExcludeDomains] = useState("");

  // Active Job & Live Logs state
  const [activeJob, setActiveJob] = useState<BacklinkOpportunityJobRow | null>(null);
  const [jobLogs, setJobLogs] = useState<BacklinkOpportunityJobLogRow[]>([]);

  // Results state
  const [opportunities, setOpportunities] = useState<BacklinkOpportunityRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());

  // Filter state
  const [search, setSearch] = useState("");
  const [siteType, setSiteType] = useState("All");
  const [cmsType, setCmsType] = useState("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [minCompetitorCount, setMinCompetitorCount] = useState<number>(0);
  const [hasRegistration, setHasRegistration] = useState(false);
  const [hasSubmit, setHasSubmit] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Load projects initially
  const loadProjects = async () => {
    try {
      const res = await fetch("/api/backlink-opportunities/projects");
      const data = await res.json();
      if (data.ok) {
        setProjects(data.data);
        if (data.data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Fetch project details when selection changes
  const fetchProjectDetails = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/backlink-opportunities/projects/${id}`);
      const data = await res.json();
      if (data.ok) {
        setProjectDetail(data.data);
        // Find running/queued job
        const runningJob = data.data.recentJobs.find(
          (j: any) => j.status === "queued" || j.status === "running"
        );
        if (runningJob) {
          setActiveJob(runningJob);
        } else if (data.data.recentJobs.length > 0) {
          setActiveJob(data.data.recentJobs[0]); // fallback to show the latest completed/failed job
        } else {
          setActiveJob(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch project details", err);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
      setPage(1);
      setSelectedResultIds(new Set());
    } else {
      setProjectDetail(null);
      setActiveJob(null);
      setOpportunities([]);
      setTotalCount(0);
    }
  }, [selectedProjectId]);

  // Fetch opportunities (results)
  const fetchOpportunities = async () => {
    if (!selectedProjectId) return;
    try {
      const query = new URLSearchParams({
        projectId: selectedProjectId,
        page: String(page),
        pageSize: String(pageSize),
        hasRegistration: String(hasRegistration),
        hasSubmit: String(hasSubmit),
        hasProfile: String(hasProfile),
      });

      if (search.trim()) query.set("search", search.trim());
      if (siteType !== "All") query.set("siteType", siteType);
      if (cmsType !== "All") query.set("cmsType", cmsType);
      if (minScore > 0) query.set("minScore", String(minScore));
      if (minCompetitorCount > 0) query.set("minCompetitorCount", String(minCompetitorCount));

      const res = await fetch(`/api/backlink-opportunities/results?${query.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setOpportunities(data.data.rows);
        setTotalCount(data.data.count);
      }
    } catch (err) {
      console.error("Failed to fetch opportunities", err);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [
    selectedProjectId,
    page,
    pageSize,
    search,
    siteType,
    cmsType,
    minScore,
    minCompetitorCount,
    hasRegistration,
    hasSubmit,
    hasProfile,
  ]);

  // Active Job Polling
  useEffect(() => {
    if (!activeJob) {
      setJobLogs([]);
      return;
    }

    const isRunning = activeJob.status === "queued" || activeJob.status === "running";
    
    // Fetch initial logs
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/api/backlink-opportunities/jobs/${activeJob.id}`); // Wait, API path check
        // Oh, our API path is `/api/backlink-opportunities/jobs/[jobId]`
        const resJob = await fetch(`/api/backlink-opportunities/jobs/${activeJob.id}`);
        const data = await resJob.json();
        if (data.ok) {
          setJobLogs(data.data.logs);
          setActiveJob(data.data.job);
          
          if (data.data.job.status !== "queued" && data.data.job.status !== "running") {
            // Job just finished, refresh results
            fetchOpportunities();
            fetchProjectDetails(selectedProjectId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch job logs", err);
      }
    };

    fetchLogs();

    if (!isRunning) return;

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status]);

  // Project form handlers
  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormName("");
    setFormMyDomain("");
    setFormCompetitors("");
    setFormError("");
    setShowProjectForm(true);
  };

  const handleOpenEdit = () => {
    if (!projectDetail) return;
    setIsEditing(true);
    setFormName(projectDetail.project.name);
    setFormMyDomain(projectDetail.project.my_domain);
    setFormCompetitors(projectDetail.competitors.join("\n"));
    setFormError("");
    setShowProjectForm(true);
  };

  const handleSaveProject = async () => {
    setFormError("");
    const actionInput = {
      name: formName,
      myDomain: formMyDomain,
      competitors: formCompetitors,
    };

    startTransition(async () => {
      let res;
      if (isEditing && projectDetail) {
        res = await updateBacklinkProjectAction(projectDetail.project.id, actionInput);
      } else {
        res = await createBacklinkProjectAction(actionInput);
      }

      if (res.ok) {
        setShowProjectForm(false);
        await loadProjects();
        if (res.data) {
          setSelectedProjectId(res.data.id);
          fetchProjectDetails(res.data.id);
        }
      } else {
        setFormError(res.error || "Có lỗi xảy ra.");
      }
    });
  };

  const handleDeleteProject = async () => {
    if (!projectDetail || !confirm("Bạn có chắc chắn muốn xóa dự án này cùng tất cả dữ liệu liên quan?")) return;
    startTransition(async () => {
      const res = await deleteBacklinkProjectAction(projectDetail.project.id);
      if (res.ok) {
        setProjectDetail(null);
        setSelectedProjectId("");
        await loadProjects();
      } else {
        alert(res.error || "Không thể xóa dự án.");
      }
    });
  };

  // Launch job handlers
  const handleOpenLaunch = () => {
    setLaunchSourceLimit(100);
    setLaunchExcludeDomains("");
    setShowLaunchModal(true);
  };

  const handleStartAnalysis = async () => {
    if (!selectedProjectId) return;
    setShowLaunchModal(false);
    startTransition(async () => {
      const res = await startBacklinkOpportunityJobAction({
        projectId: selectedProjectId,
        sourceLimit: launchSourceLimit,
        excludeDomains: launchExcludeDomains,
      });

      if (res.ok && res.jobId) {
        fetchProjectDetails(selectedProjectId);
      } else {
        alert(res.error || "Không thể khởi chạy tiến trình quét.");
      }
    });
  };

  const handleStopAnalysis = async () => {
    if (!activeJob || !confirm("Bạn có chắc chắn muốn dừng tiến trình quét này?")) return;
    startTransition(async () => {
      const res = await cancelBacklinkOpportunityJobAction(activeJob.id);
      if (res.ok) {
        fetchProjectDetails(selectedProjectId);
      } else {
        alert(res.error || "Không thể dừng tiến trình.");
      }
    });
  };

  // Row selection & delete opportunities
  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedResultIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedResultIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedResultIds.size === opportunities.length) {
      setSelectedResultIds(new Set());
    } else {
      setSelectedResultIds(new Set(opportunities.map((o) => o.id)));
    }
  };

  const handleDeleteSelectedResults = async () => {
    if (selectedResultIds.size === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedResultIds.size} kết quả đã chọn?`)) return;
    
    startTransition(async () => {
      const ids = Array.from(selectedResultIds);
      const res = await deleteBacklinkOpportunitiesAction(ids);
      if (res.ok) {
        setSelectedResultIds(new Set());
        fetchOpportunities();
      } else {
        alert(res.error || "Lỗi khi xóa kết quả.");
      }
    });
  };

  // Export Excel handler
  const handleExportExcel = () => {
    if (!selectedProjectId) return;
    const query = new URLSearchParams({
      projectId: selectedProjectId,
      hasRegistration: String(hasRegistration),
      hasSubmit: String(hasSubmit),
      hasProfile: String(hasProfile),
    });

    if (search.trim()) query.set("search", search.trim());
    if (siteType !== "All") query.set("siteType", siteType);
    if (cmsType !== "All") query.set("cmsType", cmsType);
    if (minScore > 0) query.set("minScore", String(minScore));
    if (minCompetitorCount > 0) query.set("minCompetitorCount", String(minCompetitorCount));

    window.open(`/api/backlink-opportunities/export?${query.toString()}`, "_blank");
  };

  // Helpers
  const isJobRunning = activeJob && (activeJob.status === "queued" || activeJob.status === "running");

  return (
    <div className="space-y-6">
      {/* Top Panel - Project selection & creation */}
      <Panel className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-emerald-950/20 bg-[#090f19]">
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
          <div className="text-sm font-medium text-slate-300">Chọn dự án:</div>
          <Select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full sm:w-64 min-w-[200px]"
            disabled={isJobRunning || isPending}
          >
            {projects.length === 0 ? (
              <option value="">-- Chưa có dự án --</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.my_domain})
                </option>
              ))
            )}
          </Select>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleOpenCreate} disabled={isJobRunning || isPending}>
              <Plus size={16} /> Thêm mới
            </Button>
            {projectDetail && (
              <>
                <Button variant="ghost" onClick={handleOpenEdit} disabled={isJobRunning || isPending}>
                  <Edit size={16} /> Chỉnh sửa
                </Button>
                <Button variant="danger" onClick={handleDeleteProject} disabled={isJobRunning || isPending}>
                  <Trash2 size={16} /> Xóa dự án
                </Button>
              </>
            )}
          </div>
        </div>

        {projectDetail && (
          <div className="flex items-center gap-3">
            {isJobRunning ? (
              <Button variant="danger" onClick={handleStopAnalysis} disabled={isPending}>
                <Square size={16} className="fill-red-200" /> Dừng quét
              </Button>
            ) : (
              <Button variant="default" className="bg-[#10b981] hover:bg-[#059669] text-black" onClick={handleOpenLaunch} disabled={isPending}>
                <Play size={16} className="fill-black" /> Chạy phân tích
              </Button>
            )}
          </div>
        )}
      </Panel>

      {/* Project Creation/Editing Form */}
      {showProjectForm && (
        <Panel className="border-border/50 bg-[#070b13]">
          <div className="mb-4 text-base font-semibold text-white">
            {isEditing ? `Chỉnh sửa dự án: ${projectDetail?.project.name}` : "Tạo dự án SEO mới"}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Tên dự án</label>
                <Input
                  placeholder="Ví dụ: Dự án Coin SEO"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Domain của bạn</label>
                <Input
                  placeholder="Ví dụ: coindesk.com"
                  value={formMyDomain}
                  onChange={(e) => setFormMyDomain(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Danh sách đối thủ cạnh tranh (Từ 1 - 10 tên miền, mỗi tên miền 1 dòng)
              </label>
              <Textarea
                placeholder="cointelegraph.com&#10;cryptonews.com&#10;coingape.com"
                value={formCompetitors}
                onChange={(e) => setFormCompetitors(e.target.value)}
                disabled={isPending}
                className="min-h-[120px]"
              />
            </div>
          </div>

          {formError && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-red-950/50 border border-red-900/40 p-3 text-xs text-red-200">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowProjectForm(false)} disabled={isPending}>
              Hủy
            </Button>
            <Button variant="default" onClick={handleSaveProject} disabled={isPending}>
              {isPending ? "Đang xử lý..." : "Lưu dự án"}
            </Button>
          </div>
        </Panel>
      )}

      {/* Launcher Settings Modal (Simple Inline View) */}
      {showLaunchModal && (
        <Panel className="border-emerald-900/30 bg-[#061219]">
          <div className="mb-4 text-base font-semibold text-emerald-400 flex items-center gap-2">
            <Target size={18} /> Thiết lập quét cơ hội backlink
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Giới hạn quét đối thủ (Số link lấy từ backlinks.sh mỗi đối thủ)
              </label>
              <Input
                type="number"
                min="10"
                max="1000"
                value={launchSourceLimit}
                onChange={(e) => setLaunchSourceLimit(parseInt(e.target.value, 10) || 100)}
                disabled={isPending}
              />
              <span className="text-[10px] text-slate-400">Khuyên dùng: 100 - 300 link để tối ưu thời gian.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Loại trừ tên miền bổ sung (Mỗi tên miền 1 dòng, tùy chọn)
              </label>
              <Textarea
                placeholder="google.com&#10;youtube.com"
                value={launchExcludeDomains}
                onChange={(e) => setLaunchExcludeDomains(e.target.value)}
                disabled={isPending}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowLaunchModal(false)} disabled={isPending}>
              Hủy
            </Button>
            <Button variant="default" className="bg-[#10b981] hover:bg-[#059669] text-black" onClick={handleStartAnalysis} disabled={isPending}>
              Bắt đầu quét
            </Button>
          </div>
        </Panel>
      )}

      {/* Main Grid: Left (Job Progress & Logs), Right (Filters & Results) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Side: Job status & logs */}
        {activeJob && (
          <div className="xl:col-span-1 space-y-6">
            <Panel className="border-border/60 bg-[#070b13]">
              <div className="mb-4 text-sm font-semibold text-slate-300">Trạng thái quét hiện tại</div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Trạng thái:</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize
                    ${activeJob.status === "completed" && "bg-emerald-950/40 border border-emerald-900/60 text-emerald-300"}
                    ${activeJob.status === "running" && "bg-blue-950/40 border border-blue-900/60 text-blue-300 animate-pulse"}
                    ${activeJob.status === "queued" && "bg-amber-950/40 border border-amber-900/60 text-amber-300"}
                    ${activeJob.status === "failed" && "bg-red-950/40 border border-red-900/60 text-red-300"}
                    ${activeJob.status === "cancelled" && "bg-slate-950/40 border border-slate-900/60 text-slate-300"}
                  `}>
                    {activeJob.status === "running" && <RefreshCw size={11} className="animate-spin" />}
                    {activeJob.status === "completed" && <CheckCircle2 size={11} />}
                    {activeJob.status === "failed" && <XCircle size={11} />}
                    {activeJob.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Tiến độ crawler:</span>
                    <span className="font-semibold text-slate-200">
                      {activeJob.processed_sources}/{activeJob.total_sources}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#111a24] overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width: `${
                          activeJob.total_sources > 0
                            ? (activeJob.processed_sources / activeJob.total_sources) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-md border border-[#1a293b] bg-[#0d1622] p-2">
                    <div className="text-emerald-400 font-bold text-sm">{activeJob.success_count}</div>
                    <div className="text-slate-400 text-[10px]">Cơ hội tốt (OK)</div>
                  </div>
                  <div className="rounded-md border border-[#1a293b] bg-[#0d1622] p-2">
                    <div className="text-red-400 font-bold text-sm">{activeJob.failed_count}</div>
                    <div className="text-slate-400 text-[10px]">Lỗi/Bỏ qua (FAIL)</div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="border-border/60 bg-[#070b13] p-4 flex flex-col min-h-[300px] max-h-[500px]">
              <div className="mb-2 text-xs font-semibold text-slate-400">Nhật ký trực tiếp (Logs)</div>
              <div className="flex-1 overflow-y-auto rounded-md border border-[#1a293b] bg-[#03070d] p-3 font-mono text-[11px] leading-relaxed text-slate-300 space-y-1.5 min-h-[200px]">
                {jobLogs.length === 0 ? (
                  <div className="text-slate-500 italic">Chưa có bản ghi nhật ký.</div>
                ) : (
                  jobLogs.map((log) => {
                    const time = new Date(log.created_at).toLocaleTimeString();
                    return (
                      <div key={log.id} className="whitespace-pre-wrap">
                        <span className="text-slate-500 mr-1.5">[{time}]</span>
                        <span className={`
                          ${log.level === "error" && "text-red-400 font-semibold"}
                          ${log.level === "warn" && "text-amber-400"}
                          ${log.level === "info" && "text-slate-300"}
                        `}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* Right Side: Filters & Opportunities Table */}
        <div className={activeJob ? "xl:col-span-3 space-y-6" : "xl:col-span-4 space-y-6"}>
          
          {/* Filters Bar */}
          <Panel className="border-border/50 bg-[#070b13] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Tìm kiếm nhanh</label>
                <Input
                  placeholder="URL, Domain hoặc Tiêu đề..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Loại trang web</label>
                <Select value={siteType} onChange={(e) => setSiteType(e.target.value)}>
                  {SITE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "Tất cả các loại" : opt}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Mã nguồn (CMS)</label>
                <Select value={cmsType} onChange={(e) => setCmsType(e.target.value)}>
                  {CMS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "All" ? "Tất cả CMS" : opt}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Điểm số tối thiểu</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Số đối thủ tối thiểu</label>
                  <Input
                    type="number"
                    min="0"
                    value={minCompetitorCount}
                    onChange={(e) => setMinCompetitorCount(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

            </div>

            {/* Checkbox filters */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#162130] pt-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={hasRegistration}
                    onChange={(e) => setHasRegistration(e.target.checked)}
                    className="rounded border-[#1f2b3a] bg-[#0d141d] text-primary focus:ring-0"
                  />
                  <span>Có link đăng ký</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={hasSubmit}
                    onChange={(e) => setHasSubmit(e.target.checked)}
                    className="rounded border-[#1f2b3a] bg-[#0d141d] text-primary focus:ring-0"
                  />
                  <span>Có link gửi bài</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={hasProfile}
                    onChange={(e) => setHasProfile(e.target.checked)}
                    className="rounded border-[#1f2b3a] bg-[#0d141d] text-primary focus:ring-0"
                  />
                  <span>Có link profile</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleExportExcel} disabled={opportunities.length === 0}>
                  <Download size={15} /> Xuất Excel (XLSX)
                </Button>
                <Button variant="ghost" onClick={fetchOpportunities}>
                  <RefreshCw size={15} /> Làm mới
                </Button>
              </div>
            </div>
          </Panel>

          {/* Results Table Panel */}
          <Panel className="border-border/50 bg-[#070b13] p-0 overflow-hidden">
            
            {/* Header controls inside table card */}
            <div className="flex items-center justify-between border-b border-[#162130] p-4 bg-[#090f19]">
              <div className="text-xs font-semibold text-slate-400">
                Hiển thị <span className="text-white">{opportunities.length}</span> cơ hội trên tổng số <span className="text-white">{totalCount}</span> kết quả
              </div>
              {selectedResultIds.size > 0 && (
                <Button variant="danger" onClick={handleDeleteSelectedResults} className="h-8 text-xs">
                  <Trash2 size={13} /> Xóa {selectedResultIds.size} đã chọn
                </Button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b121e] text-slate-300 font-semibold border-b border-[#162130]">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={opportunities.length > 0 && selectedResultIds.size === opportunities.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-[#1f2b3a] bg-[#0d141d]"
                      />
                    </th>
                    <th className="p-3">Liên kết nguồn (Source URL)</th>
                    <th className="p-3 w-20 text-center">Score</th>
                    <th className="p-3 w-28 text-center">Số đối thủ</th>
                    <th className="p-3 w-24">CMS</th>
                    <th className="p-3 w-24">Loại web</th>
                    <th className="p-3">Email liên hệ</th>
                    <th className="p-3 w-36 text-center">Liên kết chức năng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#121c2a] text-slate-300">
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                        Không tìm thấy cơ hội đi backlink nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    opportunities.map((row) => {
                      const hasRegUrl = row.registration_urls.length > 0;
                      const hasSubUrl = row.submit_urls.length > 0;
                      const hasProfUrl = row.profile_urls.length > 0;
                      const emailsStr = row.emails.map((e) => e.value).join(", ");

                      return (
                        <tr key={row.id} className="hover:bg-[#0d1522] transition">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedResultIds.has(row.id)}
                              onChange={() => handleToggleSelectRow(row.id)}
                              className="rounded border-[#1f2b3a] bg-[#0d141d]"
                            />
                          </td>
                          <td className="p-3 max-w-[100px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-200 truncate" title={row.title || row.source_url}>
                                {row.title || row.source_domain}
                              </span>
                              <a
                                href={row.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-primary flex items-center gap-1 font-mono text-[10px] break-all"
                              >
                                {row.source_url.length > 55 ? row.source_url.slice(0, 55) + "..." : row.source_url}
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold
                              ${row.score >= 70 && "bg-emerald-950/50 text-emerald-400 border border-emerald-900/60"}
                              ${row.score >= 40 && row.score < 70 && "bg-blue-950/50 text-blue-400 border border-blue-900/60"}
                              ${row.score < 40 && "bg-slate-950/50 text-slate-400 border border-slate-900/40"}
                            `}>
                              {row.score}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-200">{row.competitor_count}</span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[100px]" title={row.competitors.join(", ")}>
                                {row.competitors.join(", ")}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[11px] font-medium ${row.cms_type !== "Unknown" ? "text-primary" : "text-slate-400"}`}>
                              {row.cms_type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-[11px] font-medium text-slate-200">{row.site_type}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-slate-200 break-all" title={emailsStr}>
                              {emailsStr || <span className="text-slate-500 italic">Không có</span>}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-center gap-2">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold
                                ${hasRegUrl ? "bg-emerald-950/40 border border-emerald-900/60 text-emerald-300" : "bg-slate-900/30 text-slate-500 border border-slate-800/40"}
                              `} title={hasRegUrl ? row.registration_urls.map(r=>r.url).join("\n") : "Không phát hiện"}>
                                Đăng ký
                              </span>
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold
                                ${hasSubUrl ? "bg-blue-950/40 border border-blue-900/60 text-blue-300" : "bg-slate-900/30 text-slate-500 border border-slate-800/40"}
                              `} title={hasSubUrl ? row.submit_urls.map(r=>r.url).join("\n") : "Không phát hiện"}>
                                Gửi bài
                              </span>
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold
                                ${hasProfUrl ? "bg-purple-950/40 border border-purple-900/60 text-purple-300" : "bg-slate-900/30 text-slate-500 border border-slate-800/40"}
                              `} title={hasProfUrl ? row.profile_urls.map(r=>r.url).join("\n") : "Không phát hiện"}>
                                Profile
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between border-t border-[#162130] p-4 bg-[#090f19]">
                <div className="text-xs text-slate-400">
                  Hiển thị từ <span className="text-white">{(page - 1) * pageSize + 1}</span> đến{" "}
                  <span className="text-white">{Math.min(page * pageSize, totalCount)}</span> trong số{" "}
                  <span className="text-white">{totalCount}</span> kết quả
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 text-xs"
                  >
                    Trước
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                    className="h-8 text-xs"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}

          </Panel>

        </div>

      </div>
    </div>
  );
}
