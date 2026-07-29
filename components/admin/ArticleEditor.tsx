"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PILLARS, type Article } from "@/lib/almanac-data";
import { saveArticle, deleteArticle, type ArticleInput } from "@/lib/almanac-actions";
import { AiGlow } from "@/components/ai/AiGlow";
import { PEERIE, RING_COLOURS } from "@/lib/peerie";

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
      {/* Peerie Bot — same identity + working-glow as the rest of the app */}
      <AiGlow active={busy === "ai"}>
        <section className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full text-sm text-paper shadow-soft"
              style={{ background: `conic-gradient(${RING_COLOURS.join(", ")}, ${RING_COLOURS[0]})` }}>{PEERIE.spark}</span>
            <div>
              <h2 className="font-display text-lg font-bold leading-none">{PEERIE.name}</h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{PEERIE.role}</span>
            </div>
            <span className="ml-1 rounded-pill bg-ink/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">{PEERIE.tag}</span>
          </div>
          <p className="text-sm text-ink-soft">
            Draft a Shetland dialect-word article from your dictionary — leave the word blank for a surprise. Review and tweak anything before you publish.
          </p>
          <div className="flex flex-wrap gap-2">
            <input className={field + " max-w-xs"} placeholder="A word (optional), e.g. gansey" value={word} onChange={(e) => setWord(e.target.value)} disabled={busy === "ai"} />
            <button type="button" onClick={draftWithAI} disabled={busy === "ai"}
              className="shrink-0 rounded-pill px-5 py-2.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-50" style={{ background: "#2a8b5c" }}>
              {busy === "ai" ? `${PEERIE.name} is working…` : `${PEERIE.spark} Draft it with ${PEERIE.name}`}
            </button>
          </div>
        </section>
      </AiGlow>

      {msg && <p className={"rounded-lg px-3 py-2 text-sm font-semibold " + (msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{msg.text}</p>}

      <AiGlow active={busy === "ai"} className="block">
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
      </AiGlow>

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
