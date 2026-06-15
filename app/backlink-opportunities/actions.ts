"use server";

import { BacklinkOpportunityRepository } from "@/lib/repositories/backlink-opportunity-repository";
import { runBacklinkOpportunityJob } from "@/lib/services/backlink-opportunity-runner";
import { normalizeDomain, normalizeDomainList } from "@/lib/utils/domain";
import { revalidatePath } from "next/cache";

export async function createBacklinkProjectAction(input: {
  name: string;
  myDomain: string;
  competitors: string;
}) {
  const repo = new BacklinkOpportunityRepository();

  const name = input.name.trim();
  const myDomain = normalizeDomain(input.myDomain);
  
  if (!name) {
    return { ok: false, error: "Tên dự án không được để trống." };
  }

  if (!myDomain) {
    return { ok: false, error: "Tên miền của bạn không hợp lệ." };
  }

  const competitorList = normalizeDomainList(input.competitors);
  
  if (competitorList.length < 1 || competitorList.length > 10) {
    return {
      ok: false,
      error: `Số lượng đối thủ cạnh tranh phải từ 1 đến 10 tên miền (hiện tại có ${competitorList.length}).`,
    };
  }

  if (competitorList.includes(myDomain)) {
    return {
      ok: false,
      error: "Tên miền của bạn không được trùng với bất kỳ tên miền đối thủ nào.",
    };
  }

  try {
    const project = await repo.createProject({
      name,
      myDomain,
      competitors: competitorList,
    });
    revalidatePath("/backlink-opportunities");
    return { ok: true, data: project };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi tạo dự án." };
  }
}

export async function updateBacklinkProjectAction(
  projectId: string,
  input: { name: string; myDomain: string; competitors: string }
) {
  const repo = new BacklinkOpportunityRepository();
  
  const name = input.name.trim();
  const myDomain = normalizeDomain(input.myDomain);

  if (!name) {
    return { ok: false, error: "Tên dự án không được để trống." };
  }

  if (!myDomain) {
    return { ok: false, error: "Tên miền của bạn không hợp lệ." };
  }

  const competitorList = normalizeDomainList(input.competitors);

  if (competitorList.length < 1 || competitorList.length > 10) {
    return {
      ok: false,
      error: `Số lượng đối thủ cạnh tranh phải từ 1 đến 10 tên miền (hiện tại có ${competitorList.length}).`,
    };
  }

  if (competitorList.includes(myDomain)) {
    return {
      ok: false,
      error: "Tên miền của bạn không được trùng với bất kỳ tên miền đối thủ nào.",
    };
  }

  try {
    const project = await repo.updateProject(projectId, { name, myDomain });
    await repo.replaceCompetitors(projectId, competitorList);
    revalidatePath("/backlink-opportunities");
    return { ok: true, data: project };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi cập nhật dự án." };
  }
}

export async function deleteBacklinkProjectAction(projectId: string) {
  const repo = new BacklinkOpportunityRepository();
  try {
    await repo.deleteProject(projectId);
    revalidatePath("/backlink-opportunities");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi xóa dự án." };
  }
}

export async function startBacklinkOpportunityJobAction(input: {
  projectId: string;
  sourceLimit?: number;
  excludeDomains?: string;
}) {
  const repo = new BacklinkOpportunityRepository();
  
  const sourceLimit = input.sourceLimit || 100;
  const excludeList = normalizeDomainList(input.excludeDomains || "");

  try {
    const job = await repo.createJob(input.projectId, {
      source_limit: sourceLimit,
      exclude_domains: excludeList,
    });

    // Start background process
    runBacklinkOpportunityJob(job.id).catch((err) => {
      console.error(`Error running job ${job.id}:`, err);
    });

    return { ok: true, jobId: job.id };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi khởi chạy tiến trình quét." };
  }
}

export async function cancelBacklinkOpportunityJobAction(jobId: string) {
  const repo = new BacklinkOpportunityRepository();
  try {
    await repo.updateJob(jobId, { status: "cancelled" });
    await repo.addLog(jobId, "Tiến trình quét bị hủy bởi người dùng.", "warn");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi hủy tiến trình quét." };
  }
}

export async function deleteBacklinkOpportunitiesAction(ids: string[]) {
  const repo = new BacklinkOpportunityRepository();
  try {
    await repo.deleteOpportunities(ids);
    revalidatePath("/backlink-opportunities");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi xóa kết quả phân tích." };
  }
}
