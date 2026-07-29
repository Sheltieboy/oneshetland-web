import Link from "next/link";
import { notFound } from "next/navigation";
import { getWord, getWordBySlug, SPIK_COLOR } from "@/lib/spik-data";
import { getRegions } from "@/lib/fetch-data.server";
import { AddVariationForm } from "@/components/spik/AddVariationForm";

export const dynamic = "force-dynamic";

async function resolve(slug: string) {
  return (await getWordBySlug(slug)) ?? (/^\d+$/.test(slug) ? await getWord(slug) : null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await resolve(slug);
  return { title: w ? `Add a local variation · ${w.word} · Spik` : "Add a local variation · Spik" };
}

export default async function AddVariationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [w, regions] = await Promise.all([resolve(slug), getRegions()]);
  if (!w) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/spik/${w.slug || w.id}`} className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline">← Back to {w.word}</Link>
      <div className="mt-4">
        <p className="eyebrow" style={{ color: SPIK_COLOR }}>Spik · local variations</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-ink">Add a local variation</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Do you say or spell <span className="font-bold">&ldquo;{w.word}&rdquo;</span> differently where you&apos;re from?
          Add your version below — with your own voice, if you like. A moderator checks every variation before it goes live.
        </p>
      </div>
      <div className="mt-8">
        <AddVariationForm wordId={w.id} word={w.word} regions={regions} />
      </div>
    </div>
  );
}
