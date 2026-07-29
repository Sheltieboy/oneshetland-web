"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PILLARS, type Article } from "@/lib/almanac-data";
import { saveArticle, deleteArticle, type ArticleInput } from "@/lib/almanac-actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:border-teal";
const label = "mb-1 block text-sm font-semibold text-ink-soft";

export function ArticleEditor({ article }: { article: Article | null }) {
  const router = useRouter();
  const [f, setF] = useState<ArticleInput>({
    id: article?.id,
    slug: article?.slug ?? "",
    title: article?.title ?? "",
    excerpt: article?.excerpt ?? "",
    body: article?.body ?? "",
    hero_url: article?.hero_url ?? "",
    pillar: article?.pillar ?? "dialect",
    status: article?.status ?? "draft",
    publish_at: article?.publish_at ? article.publish_at.slice(0, 16) : "",
    seo_title: article?.seo_title ?? "",
    seo_description: article?.seo_description ?? "",
    linked_entities: article?.linked_entities ?? [],
    source: (article as unknown as { source?: unknown })?.source ?? null,
  });
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof ArticleInput, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  async function draftWithAI() {
    setBusy("ai"); setMsg(null);
    try {
      const res = await fetch("/api/ai/draft-article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe: "spik_word", word: word.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Peerie Bot couldn't draft that.");
      setF((p) => ({ ...p, title: d.title, slug: d.slug, excerpt: d.excerpt, body: d.body, seo_title: d.seo_title, seo_description: d.seo_description, pillar: d.pillar, linked_entities: d.linked_entities, source: d.source }));
      setMsg({ ok: true, text: "Draft ready — review and publish when you're happy." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); }
    finally { setBusy(null); }
  }

  async function save(status: string) {
    setBusy("save"); setMsg(null);
    const payload: ArticleInput = { ...f, status, publish_at: f.publish_at ? new Date(f.publish_at).toISOString() : null };
    const res = await saveArticle(payload);
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: res.error || "Save failed." }); return; }
    setMsg({ ok: true, text: status === "published" ? "Published." : status === "scheduled" ? "Scheduled." : "Saved." });
    if (!f.id && res.id) router.replace(`/admin/almanac/${res.id}`);
    router.refresh();
  }

  async function remove() {
    if (!f.id) return;
    setBusy("save");
    const res = await deleteArticle(f.id);
    setBusy(null);
    if (res.ok) router.replace("/admin/almanac");
    else setMsg({ ok: false, text: res.error || "Delete failed." });
  }

  return (
    <div className="space-y-5">
      {/* Peerie Bot */}
      <div className="rounded-card border border-teal/40 bg-teal/5 p-4">
        <p className="font-display font-bold text-navy">✨ Draft with Peerie Bot</p>
        <p className="mt-0.5 text-sm text-ink-soft">Generate a Shetland dialect-word article from the dictionary. Leave blank for a surprise word.</p>
        <div className="mt-3 flex gap-2">
          <input className={field + " max-w-xs"} placeholder="A word (optional), e.g. gansey" value={word} onChange={(e) => setWord(e.target.value)} />
          <button onClick={draftWithAI} disabled={busy === "ai"} className="shrink-0 rounded-pill bg-teal px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50">
            {busy === "ai" ? "Writing…" : "Draft it"}
          </button>
        </div>
      </div>

      {msg && <p className={"rounded-lg px-3 py-2 text-sm font-semibold " + (msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{msg.text}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={label}>Title</label><input className={field} value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div><label className={label}>Slug</label><input className={field} value={f.slug} onChange={(e) => set("slug", e.target.value)} /></div>
        <div><label className={label}>Pillar</label>
          <select className={field} value={f.pillar} onChange={(e) => set("pillar", e.target.value)}>
            {PILLARS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className={label}>Excerpt (standfirst)</label><input className={field} value={f.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Body (Markdown)</label><textarea className={field + " min-h-[360px] font-mono text-sm"} value={f.body} onChange={(e) => set("body", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Hero image URL (optional)</label><input className={field} value={f.hero_url ?? ""} onChange={(e) => set("hero_url", e.target.value)} placeholder="https://…" /></div>
        <div><label className={label}>SEO title</label><input className={field} value={f.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} /></div>
        <div><label className={label}>SEO description</label><input className={field} value={f.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} /></div>
        <div><label className={label}>Publish date/time</label><input type="datetime-local" className={field} value={f.publish_at ?? ""} onChange={(e) => set("publish_at", e.target.value)} /></div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button onClick={() => save("draft")} disabled={busy === "save"} className="rounded-pill border border-line-strong px-5 py-2 text-sm font-bold text-ink-soft hover:bg-sand disabled:opacity-50">Save draft</button>
        <button onClick={() => save("scheduled")} disabled={busy === "save" || !f.publish_at} className="rounded-pill border border-navy px-5 py-2 text-sm font-bold text-navy hover:bg-navy/5 disabled:opacity-50">Schedule</button>
        <button onClick={() => save("published")} disabled={busy === "save"} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white transition hover:bg-navy-dark disabled:opacity-50">Publish now</button>
        {f.slug && <a href={`/almanac/${f.slug}`} target="_blank" className="text-sm font-semibold text-teal-dark hover:underline">Preview ↗</a>}
        {f.id && <button onClick={remove} disabled={busy === "save"} className="ml-auto text-sm font-semibold text-rose-600 hover:underline">Delete</button>}
      </div>
    </div>
  );
}
