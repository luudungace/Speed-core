"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Download,
  ExternalLink,
  Trash2,
  Plus,
  Edit,
  Search,
  AlertTriangle,
  Import,
} from "lucide-react";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui";

import {
  createDorkProjectAction,
  updateDorkProjectAction,
  deleteDorkProjectAction,
  startDorkJobAction,
  cancelDorkJobAction,
  importDiscoveredForumsAction,
  deleteDiscoveredForumsAction,
} from "@/app/dork-scraper/actions";
import type {
  DorkProjectRow,
  DorkJobRow,
  DiscoveredForumRow,
} from "@/lib/types/dork-scraper";
import * as XLSX from "xlsx";

const CMS_OPTIONS = ["All CMS", "XenForo", "WordPress", "vBulletin", "phpBB", "SMF", "Discourse", "Unknown"];
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "discovered", label: "Mới tìm thấy" },
  { value: "imported", label: "Đã đưa vào đăng ký" },
  { value: "ignored", label: "Đã bỏ qua" },
];

const DORK_TEMPLATES = [
  { label: "phpBB (viewtopic)", dork: "inurl:viewtopic.php" },
  { label: "vBulletin (showthread)", dork: "inurl:showthread.php" },
  { label: "XenForo (threads)", dork: "inurl:threads/" },
  { label: "Discourse (/t/)", dork: "inurl:/t/" },
  { label: "SMF (index?topic)", dork: "inurl:index.php?topic" },
  { label: "XenForo title", dork: 'intitle:"Community platform by XenForo"' },
];

export function DorkScraperClient() {
  const [isPending, startTransition] = useTransition();

  // State
  const [projects, setProjects] = useState<DorkProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectDetail, setProjectDetail] = useState<{
    project: DorkProjectRow;
    jobs: DorkJobRow[];
  } | null>(null);

  // Form project state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formDorks, setFormDorks] = useState("");
  const [formExcludeDomains, setFormExcludeDomains] = useState("");
  const [formError, setFormError] = useState("");

  // Running job status
  const [activeJob, setActiveJob] = useState<DorkJobRow | null>(null);

  // Discovered forums state
  const [forums, setForums] = useState<DiscoveredForumRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCms, setFilterCms] = useState("All CMS");
  const [filterStatus, setFilterStatus] = useState("discovered");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // 1. Load Projects List
  const loadProjects = async () => {
    try {
      const res = await fetch("/api/dork-scraper/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          // Auto select first project
          setSelectedProjectId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách dự án:", err);
    }
  };

  // 2. Load Project Detail & Recent Jobs
  const fetchProjectDetails = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/dork-scraper/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectDetail(data);
        
        // Find if there is an active running job
        const running = data.jobs?.find(
          (j: DorkJobRow) => j.status === "running" || j.status === "queued"
        );
        if (running) {
          setActiveJob(running);
        } else {
          setActiveJob(null);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết dự án:", err);
    }
  }, []);

  // 3. Load Discovered Forums (with filters)
  const fetchForums = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const params = new URLSearchParams({
        projectId,
        page: String(page),
        pageSize: String(pageSize),
      });

      if (filterSearch) params.set("search", filterSearch);
      if (filterCms && filterCms !== "All CMS") params.set("cmsType", filterCms);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/dork-scraper/results?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setForums(data.rows || []);
        setTotalCount(data.count || 0);
        setSelectedIds(new Set()); // Reset selection
      }
    } catch (err) {
      console.error("Lỗi khi tải kết quả dork:", err);
    }
  }, [page, filterSearch, filterCms, filterStatus]);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

  // Sync on project change
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
      fetchForums(selectedProjectId);
    } else {
      setProjectDetail(null);
      setActiveJob(null);
      setForums([]);
      setTotalCount(0);
    }
  }, [selectedProjectId, page, filterSearch, filterCms, filterStatus, fetchProjectDetails, fetchForums]);

  // Poll job status if active job is running
  useEffect(() => {
    if (!activeJob) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/dork-scraper/jobs/${activeJob.id}`);
        if (res.ok) {
          const { job } = await res.json();
          if (job) {
            if (job.status !== "running" && job.status !== "queued") {
              // Job completed/failed/cancelled
              setActiveJob(null);
              clearInterval(interval);
              if (selectedProjectId) {
                fetchProjectDetails(selectedProjectId);
                fetchForums(selectedProjectId);
              }
            } else {
              // Update running progress
              setActiveJob(job);
            }
          }
        }
      } catch (err) {
        console.error("Lỗi khi kiểm tra trạng thái job:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, selectedProjectId, fetchProjectDetails, fetchForums]);

  // Project forms handlers
  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormName("");
    setFormKeywords("");
    setFormDorks("");
    setFormExcludeDomains("");
    setFormError("");
    setShowProjectForm(true);
  };

  const handleOpenEdit = () => {
    if (!projectDetail) return;
    setIsEditing(true);
    setFormName(projectDetail.project.name);
    setFormKeywords(projectDetail.project.keywords.join("\n"));
    setFormDorks(projectDetail.project.dorks.join("\n"));
    setFormExcludeDomains(projectDetail.project.exclude_domains?.join("\n") || "");
    setFormError("");
    setShowProjectForm(true);
  };

  const handleApplyDorkTemplate = (dork: string) => {
    setFormDorks((prev) => {
      const current = prev.trim();
      if (!current) return dork;
      if (current.includes(dork)) return prev;
      return `${current}\n${dork}`;
    });
  };

  const handleSaveProject = async () => {
    setFormError("");
    const actionInput = {
      name: formName,
      keywords: formKeywords,
      dorks: formDorks,
      excludeDomains: formExcludeDomains,
    };

    startTransition(async () => {
      let res;
      if (isEditing && projectDetail) {
        res = await updateDorkProjectAction(projectDetail.project.id, actionInput);
      } else {
        res = await createDorkProjectAction(actionInput);
      }

      if (res.ok) {
        setShowProjectForm(false);
        await loadProjects();
        if (res.data) {
          setSelectedProjectId(res.data.id);
        }
      } else {
        setFormError(res.error || "Có lỗi xảy ra.");
      }
    });
  };

  const handleDeleteProject = async () => {
    if (!projectDetail || !confirm("Bạn có chắc chắn muốn xóa dự án dorking này cùng tất cả diễn đàn tìm được?")) return;
    startTransition(async () => {
      const res = await deleteDorkProjectAction(projectDetail.project.id);
      if (res.ok) {
        setProjectDetail(null);
        setSelectedProjectId("");
        await loadProjects();
      } else {
        alert(res.error || "Không thể xóa dự án.");
      }
    });
  };

  // Job actions
  const handleStartJob = async () => {
    if (!selectedProjectId) return;
    startTransition(async () => {
      const res = await startDorkJobAction(selectedProjectId);
      if (res.ok && res.jobId) {
        // Find job in detail
        await fetchProjectDetails(selectedProjectId);
      } else {
        alert(res.error || "Không thể bắt đầu quét.");
      }
    });
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    startTransition(async () => {
      const res = await cancelDorkJobAction(activeJob.id);
      if (res.ok) {
        setActiveJob(null);
        if (selectedProjectId) fetchProjectDetails(selectedProjectId);
      }
    });
  };

  // Discovered forums list handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(forums.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleImportSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    if (!confirm(`Bạn có chắc chắn muốn đưa ${ids.length} diễn đàn đã chọn vào hàng đợi đăng ký tài khoản tự động?`)) return;

    startTransition(async () => {
      const res = await importDiscoveredForumsAction(ids);
      if (res.ok) {
        alert(`Đã đưa thành công ${res.importedCount} diễn đàn vào hàng đợi đăng ký!`);
        fetchForums(selectedProjectId);
      } else {
        alert(res.error || "Có lỗi xảy ra khi nhập hàng đợi.");
      }
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa bỏ ${ids.length} diễn đàn đã chọn khỏi kết quả dork?`)) return;

    startTransition(async () => {
      const res = await deleteDiscoveredForumsAction(ids);
      if (res.ok) {
        fetchForums(selectedProjectId);
      } else {
        alert(res.error || "Lỗi khi xóa kết quả.");
      }
    });
  };

  const handleExportExcel = async () => {
    if (!selectedProjectId) return;
    try {
      // Fetch all discovered forums for this project to export (not paginated)
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        page: "1",
        pageSize: "10000", // Grab everything
      });
      if (filterSearch) params.set("search", filterSearch);
      if (filterCms && filterCms !== "All CMS") params.set("cmsType", filterCms);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/dork-scraper/results?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const exportData = (data.rows || []).map((f: DiscoveredForumRow) => ({
          "Tên miền": f.domain,
          "Loại CMS": f.cms_type,
          "Điểm số": f.score,
          "URL tìm thấy": f.source_url,
          "Trạng thái": f.status === "discovered" ? "Mới phát hiện" : f.status === "imported" ? "Đã nhập" : "Đã bỏ qua",
          "Ngày đăng bài": f.publish_date || "--",
          "Ngày phát hiện": new Date(f.created_at).toLocaleString("vi-VN"),
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        Xsub: XLSX.utils.book_append_sheet(workbook, worksheet, "Diễn đàn");
        
        // Save
        const fileName = `DienDan_Dork_${projectDetail?.project.name || "export"}.xlsx`;
        XLSX.writeFile(workbook, fileName);
      }
    } catch (err) {
      console.error("Lỗi khi xuất Excel:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
        
        {/* Top Header & Project Selector */}
        <Panel className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">Cào Dork Google & Tìm kiếm Diễn đàn</h1>
            <p className="text-xs text-slate-400">Tự động khai thác hàng ngàn diễn đàn quốc tế theo câu lệnh Google Dork.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-400">Chọn dự án Dork:</span>
            <div className="w-56">
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={isPending || !!activeJob}
              >
                <option value="">-- Chọn dự án --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            
            <Button variant="default" onClick={handleOpenCreate} disabled={isPending || !!activeJob}>
              <Plus size={14} className="mr-1.5" /> Thêm mới
            </Button>
            
            {projectDetail && (
              <>
                <Button variant="ghost" onClick={handleOpenEdit} disabled={isPending || !!activeJob}>
                  <Edit size={14} className="mr-1.5" /> Sửa
                </Button>
                <Button variant="danger" onClick={handleDeleteProject} disabled={isPending || !!activeJob}>
                  <Trash2 size={14} className="mr-1.5" /> Xóa
                </Button>
              </>
            )}
          </div>
        </Panel>

        {/* Create/Edit Project Form Panel */}
        {showProjectForm && (
          <Panel className="p-5 border-cyan-500/30">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">
              {isEditing ? "Cập nhật dự án Dorking" : "Tạo dự án Dorking mới"}
            </h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Tên dự án</label>
                <Input
                  placeholder="Ví dụ: Diễn đàn MMO quốc tế"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400">Từ khóa chủ đề (mỗi từ khóa 1 dòng)</label>
                    <span className="text-[10px] text-slate-500">Để trống nếu dork thuần</span>
                  </div>
                  <Textarea
                    placeholder="crypto&#10;make money online&#10;seo backlink"
                    value={formKeywords}
                    onChange={(e) => setFormKeywords(e.target.value)}
                    disabled={isPending}
                    className="min-h-[140px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Footprints Dork (mỗi dork 1 dòng)
                  </label>
                  <Textarea
                    placeholder="inurl:viewtopic.php&#10;inurl:showthread.php"
                    value={formDorks}
                    onChange={(e) => setFormDorks(e.target.value)}
                    disabled={isPending}
                    className="min-h-[140px]"
                  />
                  
                  {/* Dork Quick Templates */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500 self-center mr-1">Mẫu nhanh:</span>
                    {DORK_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.label}
                        type="button"
                        onClick={() => handleApplyDorkTemplate(tmpl.dork)}
                        disabled={isPending}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-0.5 rounded transition"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400">Tên miền loại trừ (mỗi domain 1 dòng)</label>
                    <span className="text-[10px] text-slate-500">Hệ thống luôn loại trừ Google, FB...</span>
                  </div>
                  <Textarea
                    placeholder="wikipedia.org&#10;stackoverflow.com"
                    value={formExcludeDomains}
                    onChange={(e) => setFormExcludeDomains(e.target.value)}
                    disabled={isPending}
                    className="min-h-[140px]"
                  />
                </div>
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
                {isEditing ? "Cập nhật" : "Lưu dự án"}
              </Button>
            </div>
          </Panel>
        )}

        {/* Project View & Job Controller */}
        {projectDetail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Panel: Configuration Info */}
            <Panel className="p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-300 border-b border-border pb-2">Thông tin cấu hình</h3>
              
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Từ khóa chủ đề ({projectDetail.project.keywords.length}):</span>
                {projectDetail.project.keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {projectDetail.project.keywords.map((kw, idx) => (
                      <span key={idx} className="text-[10px] bg-[#162130] text-slate-200 border border-slate-800 px-2 py-0.5 rounded">
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">Không có từ khóa (Quét dork thuần)</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Footprints Dork ({projectDetail.project.dorks.length}):</span>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto border border-border bg-[#030712] p-2 rounded text-xs text-slate-300 font-mono">
                  {projectDetail.project.dorks.map((dk, idx) => (
                    <div key={idx} className="truncate">
                      {idx + 1}. {dk}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Tên miền loại trừ ({projectDetail.project.exclude_domains?.length || 0}):</span>
                {projectDetail.project.exclude_domains && projectDetail.project.exclude_domains.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto border border-border bg-[#030712] p-2 rounded text-xs text-slate-400 font-mono">
                    {projectDetail.project.exclude_domains.map((dom, idx) => (
                      <div key={idx} className="truncate">
                        {idx + 1}. {dom}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">Chỉ loại trừ các trang mặc định (Google, FB, Youtube...)</span>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-2 border-t border-border pt-4">
                {activeJob ? (
                  <Button variant="danger" className="w-full" onClick={handleCancelJob} disabled={isPending}>
                    <Square size={14} className="mr-2" /> Hủy tiến trình
                  </Button>
                ) : (
                  <Button variant="default" className="w-full bg-cyan-600 hover:bg-cyan-500 border-cyan-700" onClick={handleStartJob} disabled={isPending}>
                    <Play size={14} className="mr-2" /> Bắt đầu quét Google Dork
                  </Button>
                )}
              </div>
            </Panel>

            {/* Right Panel: Job Status Panel */}
            <Panel className="lg:col-span-2 p-5 flex flex-col justify-between min-h-[220px]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-sm font-bold text-slate-300">Trạng thái quét hiện tại</h3>
                  {activeJob ? (
                    <span className="text-xs flex items-center gap-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-0.5 text-cyan-200 animate-pulse">
                      <RefreshCw size={11} className="animate-spin" /> Đang chạy...
                    </span>
                  ) : projectDetail.jobs?.[0] ? (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                      projectDetail.jobs[0].status === "completed"
                        ? "bg-green-950/50 border-green-800/50 text-green-300"
                        : projectDetail.jobs[0].status === "failed"
                        ? "bg-red-950/50 border-red-800/50 text-red-300"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}>
                      {projectDetail.jobs[0].status === "completed" ? "Đã hoàn thành" : 
                       projectDetail.jobs[0].status === "failed" ? "Lỗi hệ thống" : "Đã hủy"}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Chưa có lượt quét nào</span>
                  )}
                </div>

                {activeJob ? (
                  <div className="flex flex-col gap-4 mt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-400">Tiến độ phân tích:</span>
                      <span className="font-mono text-cyan-400">
                        {activeJob.processed_results} / {activeJob.total_results} tên miền
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 border border-slate-900 rounded-full h-3.5 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full transition-all duration-300"
                        style={{
                          width: `${
                            activeJob.total_results > 0
                              ? (activeJob.processed_results / activeJob.total_results) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 italic">
                      Hệ thống đang cào sâu qua tất cả các trang kết quả Google của câu lệnh dork, trích xuất các tên miền và chạy crawler Playwright phân tích CMS.
                    </div>
                  </div>
                ) : projectDetail.jobs?.[0] ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-slate-400">Lượt quét gần nhất:</span>
                      <span className="text-slate-200 font-mono">
                        {new Date(projectDetail.jobs[0].created_at).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-slate-400">Tổng số diễn đàn phát hiện:</span>
                      <span className="text-green-400 font-bold font-mono">
                        {projectDetail.jobs[0].total_results}
                      </span>
                    </div>
                    {projectDetail.jobs[0].error && (
                      <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 p-2.5 rounded-md mt-1">
                        Chi tiết lỗi: {projectDetail.jobs[0].error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 text-xs py-8 italic">
                    Nhấn nút "Bắt đầu quét Google Dork" ở cột bên trái để bắt đầu đào diễn đàn.
                  </div>
                )}
              </div>
            </Panel>

          </div>
        )}

        {/* Results Panel */}
        {selectedProjectId && (
          <Panel className="p-5 flex flex-col gap-4">
            
            {/* Filters Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <Input
                    placeholder="Tìm kiếm domain..."
                    value={filterSearch}
                    onChange={(e) => {
                      setFilterSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>

                <div className="w-36">
                  <Select
                    value={filterCms}
                    onChange={(e) => {
                      setFilterCms(e.target.value);
                      setPage(1);
                    }}
                  >
                    {CMS_OPTIONS.map((cms) => (
                      <option key={cms} value={cms}>
                        {cms}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-48">
                  <Select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Mass Actions */}
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <Button variant="default" onClick={handleImportSelected} disabled={isPending}>
                      <Import size={14} className="mr-1.5" /> Đưa vào hàng đợi ({selectedIds.size})
                    </Button>
                    <Button variant="danger" onClick={handleDeleteSelected} disabled={isPending}>
                      <Trash2 size={14} className="mr-1.5" /> Xóa ({selectedIds.size})
                    </Button>
                  </>
                )}
                
                {forums.length > 0 && (
                  <Button variant="ghost" onClick={handleExportExcel} disabled={isPending}>
                    <Download size={14} className="mr-1.5" /> Xuất Excel (XLSX)
                  </Button>
                )}
                
                <Button variant="ghost" onClick={() => fetchForums(selectedProjectId)} disabled={isPending}>
                  <RefreshCw size={14} className={isPending ? "animate-spin" : ""} /> Làm mới
                </Button>
              </div>
            </div>

            {/* Forums Table */}
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-[#090f19]/80 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={forums.length > 0 && selectedIds.size === forums.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={forums.length === 0}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900"
                      />
                    </th>
                    <th className="p-3">Diễn đàn (Domain)</th>
                    <th className="p-3">Loại CMS</th>
                    <th className="p-3 text-center w-28">Độ ưu tiên (Score)</th>
                    <th className="p-3 w-40">Trạng thái</th>
                    <th className="p-3">URL nguồn tìm thấy</th>
                    <th className="p-3">Ngày đăng bài</th>
                    <th className="p-3 text-right">Ngày phát hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {forums.length > 0 ? (
                    forums.map((row) => (
                      <tr key={row.id} className="hover:bg-[#101823]/30 transition group">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          <div className="flex items-center gap-1.5">
                            {row.domain}
                            <a
                              href={row.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            row.cms_type === "XenForo" ? "bg-orange-950/60 border border-orange-900/40 text-orange-200" :
                            row.cms_type === "phpBB" ? "bg-blue-950/60 border border-blue-900/40 text-blue-200" :
                            row.cms_type === "vBulletin" ? "bg-purple-950/60 border border-purple-900/40 text-purple-200" :
                            row.cms_type === "WordPress" ? "bg-cyan-950/60 border border-cyan-900/40 text-cyan-200" :
                            row.cms_type === "Unknown" ? "bg-slate-900 text-slate-400" : "bg-teal-950/60 border border-teal-900/40 text-teal-200"
                          }`}>
                            {row.cms_type}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">
                          <span className={`font-mono ${row.score >= 50 ? "text-cyan-400" : "text-slate-400"}`}>
                            {row.score}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            row.status === "discovered" ? "bg-slate-900 border-slate-700 text-slate-300" :
                            row.status === "imported" ? "bg-green-950/60 border-green-800/40 text-green-300" :
                            "bg-red-950/40 border-red-900/30 text-red-400"
                          }`}>
                            {row.status === "discovered" ? "Mới phát hiện" :
                             row.status === "imported" ? "Đã đưa vào đăng ký" : "Đã bỏ qua"}
                          </span>
                        </td>
                        <td className="p-3 max-w-[280px] truncate text-slate-400" title={row.source_url}>
                          {row.source_url}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          {row.publish_date || "--"}
                        </td>
                        <td className="p-3 text-right text-slate-500 font-mono">
                          {new Date(row.created_at).toLocaleDateString("vi-VN")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500 py-12 italic">
                        Không tìm thấy diễn đàn nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                <span className="text-slate-400">
                  Hiển thị từ <span className="text-slate-200">{(page - 1) * pageSize + 1}</span> đến{" "}
                  <span className="text-slate-200">{Math.min(page * pageSize, totalCount)}</span> trên tổng số{" "}
                  <span className="text-slate-200 font-semibold">{totalCount}</span> kết quả
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    disabled={page === 1 || isPending}
                    onClick={() => setPage(page - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={page * pageSize >= totalCount || isPending}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}

          </Panel>
        )}

    </div>
  );
}
