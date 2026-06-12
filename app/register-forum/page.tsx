import { AppShell } from "@/components/app-shell";
import { RegisterForumClient } from "@/components/register-forum/register-forum-client";
import { CrawlerRepository } from "@/lib/repositories/crawler-repository";
import { getBacklinkCandidateFromRaw } from "@/lib/utils/backlink-candidate";

export const dynamic = "force-dynamic";

function candidateRating(score: number) {
  if (score >= 55) return "Có tiềm năng";
  if (score >= 30) return "Xem xét";
  return "Không có tiềm năng";
}

export default async function RegisterForumPage() {
  const repo = new CrawlerRepository();
  const { rows } = await repo.listReviewCandidateResults();
  const candidates = rows.map((row) => {
    const candidate = getBacklinkCandidateFromRaw(row.raw_serper_data);
    const score = candidate?.score ?? 0;

    return {
      id: row.id,
      url: row.url,
      title: row.title,
      rating: candidateRating(score),
      score,
      siteType: candidate?.site_type ?? "Unknown",
    };
  });

  return (
    <AppShell title="Đăng ký diễn đàn">
      <h1 className="text-2xl font-semibold tracking-normal">Đăng ký diễn đàn</h1>
      <p className="mt-1 text-sm text-muted">Kiểm tra thủ công khả năng đăng ký tài khoản trên các website đã được đánh giá Xem xét.</p>
      <RegisterForumClient candidates={candidates} />
    </AppShell>
  );
}
