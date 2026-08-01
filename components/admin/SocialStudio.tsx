"use client";

import { useState, useTransition } from "react";
import type { SocialPost, SocialRecipe } from "@/lib/social-admin.server";
import { kindMeta } from "@/lib/social-meta";
import {
  approveSocialPost, deleteSocialPost, revertSocialPost,
  saveSocialPost, skipSocialPost, toggleSocialRecipe,
} from "@/lib/social-actions";

/**
 * Social studio — review queue for the Peerie Press social-seeding engine.
 * Composer drafts land here; approving hands them to the publisher (which
 * posts to the Facebook Page on its next 15-min pass once Meta is connected).
 */

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  approved: "bg-sky-100 text-sky-700",
  scheduled: "bg-amber-100 text-amber-700",
  posted: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-slate-100 text-slate-400",
};

const QUEUE_STATUSES = ["draft", "approved", "scheduled"];

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function KindChip({ kind }: { kind: string }) {
  const m = kindMeta(kind);
  return (
    <span className="rounded-pill px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: m.color }}>
      {m.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold " + (STATUS_STYLE[status] ?? "")}>{status}</span>;
}

function QueueCard({ post }: { post: SocialPost }) {
  const [caption, setCaption] = useState(post.caption);
  const [when, setWhen] = useState(toLocalInput(post.scheduled_for));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? okMsg : r.error ?? "Something went wrong");
    });

  return (
    <li className="flex gap-4 rounded-card border border-line bg-white p-4 shadow-soft">
      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={post.image_url} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image_url} alt="Post card preview" className="h-36 w-36 rounded-xl border border-line object-cover" />
        </a>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={post.kind} />
          <StatusPill status={post.status} />
          <span className="text-xs text-ink-muted">created {fmt(post.created_at)}</span>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          className="mt-3 w-full rounded-xl border border-line bg-cream/40 p-3 text-sm text-ink outline-none focus:border-teal"
          aria-label="Post caption"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            Post at
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            {post.status === "draft" ? (
              <button
                onClick={() => run(() => approveSocialPost(post.id, caption, fromLocalInput(when)), "Approved — will post on schedule")}
                disabled={pending}
                className="rounded-pill bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
            ) : (
              <button
                onClick={() => run(() => revertSocialPost(post.id), "Back to draft")}
                disabled={pending}
                className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand disabled:opacity-50"
              >
                Un-approve
              </button>
            )}
            <button
              onClick={() => run(() => saveSocialPost(post.id, caption, fromLocalInput(when)), "Saved")}
              disabled={pending}
              className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-sand disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => run(() => skipSocialPost(post.id), "Skipped")}
              disabled={pending}
              className="rounded-pill border border-line px-4 py-1.5 text-sm font-bold text-ink-muted hover:bg-sand disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
        {msg ? <p className="mt-2 text-xs font-semibold text-teal-dark" role="status">{msg}</p> : null}
        {post.error ? <p className="mt-2 text-xs font-semibold text-rose-600">{post.error}</p> : null}
      </div>
    </li>
  );
}

function LogRow({ post }: { post: SocialPost }) {
  const [pending, start] = useTransition();
  const fbId = post.posted_ids?.facebook;
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-white p-4 shadow-soft">
      <KindChip kind={post.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{post.caption.split("\n")[0]}</p>
        <p className="text-xs text-ink-muted">
          {post.status === "posted" ? `posted ${fmt(post.posted_at)}` : `scheduled ${fmt(post.scheduled_for)}`}
          {post.error ? ` · ${post.error}` : ""}
        </p>
      </div>
      {fbId ? (
        <a href={`https://www.facebook.com/${fbId}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-dark hover:underline">
          View on Facebook →
        </a>
      ) : null}
      <StatusPill status={post.status} />
      {(post.status === "failed" || post.status === "skipped") ? (
        <button
          onClick={() => start(async () => { await revertSocialPost(post.id); })}
          disabled={pending}
          className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand disabled:opacity-50"
        >
          Retry as draft
        </button>
      ) : null}
      {post.status !== "posted" ? (
        <button
          onClick={() => start(async () => { await deleteSocialPost(post.id); })}
          disabled={pending}
          className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          Delete
        </button>
      ) : null}
    </li>
  );
}

function RecipeRow({ recipe }: { recipe: SocialRecipe }) {
  const [enabled, setEnabled] = useState(recipe.enabled);
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-white p-4 shadow-soft">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{recipe.label}</p>
        <p className="text-xs text-ink-muted">last ran {fmt(recipe.last_run_at)}</p>
      </div>
      <span className="rounded-pill bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-400" title="Auto-posting without approval arrives in Phase 2">
        autopilot · Phase 2
      </span>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`${recipe.label} enabled`}
        disabled={pending}
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          start(async () => {
            const r = await toggleSocialRecipe(recipe.key, next);
            if (!r.ok) setEnabled(!next);
          });
        }}
        className={"relative h-7 w-12 rounded-pill transition disabled:opacity-50 " + (enabled ? "bg-emerald-500" : "bg-slate-300")}
      >
        <span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " + (enabled ? "left-6" : "left-1")} />
      </button>
    </li>
  );
}

export function SocialStudio({ posts, recipes }: { posts: SocialPost[]; recipes: SocialRecipe[] }) {
  const [tab, setTab] = useState<"queue" | "log" | "recipes">("queue");
  const queue = posts.filter((p) => QUEUE_STATUSES.includes(p.status));
  const log = posts.filter((p) => !QUEUE_STATUSES.includes(p.status));

  const tabs = [
    { key: "queue" as const, label: `Queue (${queue.length})` },
    { key: "log" as const, label: `Log (${log.length})` },
    { key: "recipes" as const, label: "Recipes" },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={"rounded-pill px-4 py-1.5 text-sm font-bold transition " + (tab === t.key ? "bg-navy text-white" : "border border-line text-ink-soft hover:bg-sand")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        queue.length === 0 ? (
          <div className="rounded-card border border-line bg-white p-10 text-center">
            <p className="font-display font-bold text-navy">Queue&apos;s clear</p>
            <p className="mt-1 text-sm text-ink-soft">The composer drafts new posts on its morning run — or trigger it manually (see DEPLOY-SOCIAL.md).</p>
          </div>
        ) : (
          <ul className="space-y-3">{queue.map((p) => <QueueCard key={p.id} post={p} />)}</ul>
        )
      )}

      {tab === "log" && (
        log.length === 0 ? (
          <div className="rounded-card border border-line bg-white p-10 text-center">
            <p className="font-display font-bold text-navy">Nothing posted yet</p>
            <p className="mt-1 text-sm text-ink-soft">Approved posts land here once the publisher has sent them to Facebook.</p>
          </div>
        ) : (
          <ul className="space-y-2">{log.map((p) => <LogRow key={p.id} post={p} />)}</ul>
        )
      )}

      {tab === "recipes" && (
        <ul className="space-y-2">{recipes.map((r) => <RecipeRow key={r.key} recipe={r} />)}</ul>
      )}
    </div>
  );
}
