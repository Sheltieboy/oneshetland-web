import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/almanac-admin.server";
import { requireAdmin } from "@/lib/admin-data.server";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit article · Admin" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  const article = isNew ? null : await getArticleById(id);
  if (!isNew && !article) notFound();

  return (
    <div>
      <Link href="/admin/almanac" className="text-sm font-semibold text-ink-soft hover:text-ink">← All articles</Link>
      <h1 className="mb-5 mt-2 font-display text-2xl font-bold text-navy">{isNew ? "New article" : "Edit article"}</h1>
      <ArticleEditor article={article} />
    </div>
  );
}
