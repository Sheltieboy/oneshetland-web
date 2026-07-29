import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchArticleBySlug, fetchRelatedArticles, pillarMeta, articleDate } from "@/lib/almanac-data";
import { ArticleBody } from "@/components/almanac/ArticleBody";
import { SafeImage } from "@/components/ui/SafeImage";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleSchema, breadcrumbSchema } from "@/lib/seo-schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await fetchArticleBySlug(slug);
  if (!a) return { title: "Article" };
  return {
    title: a.seo_title || a.title,
    description: a.seo_description || a.excerpt || undefined,
    alternates: { canonical: `/almanac/${a.slug}` },
    openGraph: { title: a.seo_title || a.title, description: a.seo_description || a.excerpt || undefined, images: a.hero_url ? [a.hero_url] : undefined, type: "article" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await fetchArticleBySlug(slug);
  if (!a) notFound();

  const pm = pillarMeta(a.pillar);
  const related = await fetchRelatedArticles(a.pillar, a.id, 3);

  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <JsonLd data={[articleSchema(a), breadcrumbSchema([{ name: "Almanac", path: "/almanac" }, { name: a.title, path: `/almanac/${a.slug}` }])]} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/almanac" className="font-semibold text-ink-soft hover:text-ink">← The Almanac</Link>
        <Link href={pm.sectionHref} className="rounded-pill px-2.5 py-1 text-xs font-bold text-white" style={{ background: pm.color }}>{pm.label}</Link>
        {a.publish_at && <span className="text-ink-muted">{articleDate(a.publish_at)}</span>}
      </div>

      <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-navy sm:text-5xl">{a.title}</h1>
      {a.excerpt && <p className="mt-3 text-xl text-ink-soft">{a.excerpt}</p>}

      {a.hero_url && (
        <div className="mt-6 overflow-hidden rounded-card shadow-soft">
          <SafeImage src={a.hero_url} alt="" className="w-full object-cover" />
        </div>
      )}

      <div className="mt-8">
        <ArticleBody markdown={a.body} />
      </div>

      <p className="mt-10 border-t border-line pt-5 text-sm text-ink-muted">
        By {a.author} · part of <Link href="/almanac" className="font-semibold text-teal-dark hover:underline">The Shetland Almanac</Link>
      </p>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-navy">More {pm.label.toLowerCase()} reads</h2>
          <ul className="mt-4 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/almanac/${r.slug}`} className="group flex items-baseline gap-2 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift">
                  <span className="font-semibold text-ink group-hover:underline">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
