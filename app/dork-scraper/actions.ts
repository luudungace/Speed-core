"use server";

import { DorkScraperRepository } from "@/lib/repositories/dork-scraper-repository";
import { RegistrationRepository } from "@/lib/repositories/registration-repository";
import { runDorkScraperJob } from "@/lib/services/dork-scraper-runner";
import { revalidatePath } from "next/cache";

function parseLines(str: string): string[] {
  return str
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function createDorkProjectAction(input: {
  name: string;
  keywords: string;
  dorks: string;
  excludeDomains: string;
}) {
  const repo = new DorkScraperRepository();
  const name = input.name.trim();
  const keywords = parseLines(input.keywords);
  const dorks = parseLines(input.dorks);
  const exclude_domains = parseLines(input.excludeDomains).map(d => d.toLowerCase().replace(/^www\./i, ""));

  if (!name) {
    return { ok: false, error: "Tên dự án không được để trống." };
  }

  if (dorks.length === 0) {
    return { ok: false, error: "Vui lòng nhập ít nhất 1 câu lệnh dork (footprint)." };
  }

  try {
    const project = await repo.createProject({
      name,
      keywords,
      dorks,
      exclude_domains,
    });
    revalidatePath("/dork-scraper");
    return { ok: true, data: project };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi tạo dự án dork." };
  }
}

export async function updateDorkProjectAction(
  projectId: string,
  input: { name: string; keywords: string; dorks: string; excludeDomains: string }
) {
  const repo = new DorkScraperRepository();
  const name = input.name.trim();
  const keywords = parseLines(input.keywords);
  const dorks = parseLines(input.dorks);
  const exclude_domains = parseLines(input.excludeDomains).map(d => d.toLowerCase().replace(/^www\./i, ""));

  if (!name) {
    return { ok: false, error: "Tên dự án không được để trống." };
  }

  if (dorks.length === 0) {
    return { ok: false, error: "Vui lòng nhập ít nhất 1 câu lệnh dork (footprint)." };
  }

  try {
    const project = await repo.updateProject(projectId, {
      name,
      keywords,
      dorks,
      exclude_domains,
    });
    revalidatePath("/dork-scraper");
    return { ok: true, data: project };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi cập nhật dự án dork." };
  }
}

export async function deleteDorkProjectAction(projectId: string) {
  const repo = new DorkScraperRepository();
  try {
    await repo.deleteProject(projectId);
    revalidatePath("/dork-scraper");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi xóa dự án dork." };
  }
}

export async function startDorkJobAction(projectId: string) {
  const repo = new DorkScraperRepository();
  try {
    const job = await repo.createJob(projectId);

    // Run in background asynchronously
    runDorkScraperJob(job.id).catch((err) => {
      console.error(`Error running dork scraper job ${job.id}:`, err);
    });

    return { ok: true, jobId: job.id };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi bắt đầu tiến trình quét dork." };
  }
}

export async function cancelDorkJobAction(jobId: string) {
  const repo = new DorkScraperRepository();
  try {
    await repo.updateJob(jobId, { status: "cancelled" });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi hủy tiến trình dork." };
  }
}

export async function importDiscoveredForumsAction(ids: string[]) {
  const dorkRepo = new DorkScraperRepository();
  const regRepo = new RegistrationRepository();

  if (ids.length === 0) {
    return { ok: false, error: "Chưa chọn diễn đàn nào để đưa vào hàng đợi." };
  }

  try {
    // We get all discovered forums rows for these ids
    // But since listDiscoveredForums is paginated, let's select them directly or update them
    // For simplicity, we can load them or write a query.
    // In our repository, we can just fetch and insert. Let's do it individually or write a helper.
    // Since we know the database structure, we can do it directly with supabase client.
    const db = regRepo["db"]; // Access Supabase client inside RegistrationRepository
    
    const { data: forums, error: fetchErr } = await db
      .from("discovered_forums")
      .select("*")
      .in("id", ids);

    if (fetchErr) throw fetchErr;

    let successCount = 0;
    for (const f of forums ?? []) {
      try {
        await regRepo.addDirectJob({
          url: f.source_url,
          cmsType: f.cms_type,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to import domain ${f.domain} into registration queue:`, err);
      }
    }

    // Mark as imported
    await dorkRepo.updateDiscoveredForumsStatus(ids, "imported");

    return { ok: true, importedCount: successCount };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi nhập vào hàng đợi đăng ký." };
  }
}

export async function deleteDiscoveredForumsAction(ids: string[]) {
  const repo = new DorkScraperRepository();
  try {
    await repo.deleteDiscoveredForums(ids);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi xóa kết quả dork." };
  }
}
