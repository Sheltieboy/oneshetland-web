"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SPIK_COLOR } from "@/lib/spik-data";
import { AudioInput } from "@/components/spik/AudioInput";

type Region = { id: string; slug: string; name: string };

/**
 * AddVariationForm — a signed-in contributor records how a word is said and
 * spelled in their part of Shetland: a region, an optional variant spelling +
 * written pronunciation, an audio clip of them saying the word, and an example
 * sentence with its own clip. Audio uploads to the `spik-audio` bucket; the row
 * lands in spik_word_variations as 'pending' for a moderator to approve.
 */
export function AddVariationForm({
  wordId,
  word,
  regions,
}: {
  wordId: number;
  word: string;
  regions: Region[];
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still checking
  const [displayName, setDisplayName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [spelling, setSpelling] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [wordAudio, setWordAudio] = useState<Blob | null>(null);
  const [sentence, setSentence] = useState("");
  const [sentenceAudio, setSentenceAudio] = useState<Blob | null>(null);
  const [showName, setShowName] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      const nm =
        (data.user?.user_metadata?.display_name as string) ||
        (data.user?.user_metadata?.full_name as string) ||
        "";
      if (nm) setDisplayName(nm);
    });
  }, []);

  function ext(blob: Blob) {
    const t = blob.type;
    if (t.includes("webm")) return "webm";
    if (t.includes("ogg")) return "ogg";
    if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
    if (t.includes("wav")) return "wav";
    return "mp3";
  }

  async function upload(sb: ReturnType<typeof createClient>, uid: string, kind: string, blob: Blob) {
    // Deterministic-ish unique path without Date/Math in a shared module: the
    // browser is fine to use them here.
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const path = `${wordId}/${uid}/${kind}-${stamp}.${ext(blob)}`;
    const { error: upErr } = await sb.storage
      .from("spik-audio")
      .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
    if (upErr) throw upErr;
    return sb.storage.from("spik-audio").getPublicUrl(path).data.publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regionId) {
      setError("Please choose which part of Shetland this variation is from.");
      return;
    }
    if (!spelling.trim() && !wordAudio) {
      setError("Add at least a local spelling or a recording of the word.");
      return;
    }
    setStatus("saving");
    try {
      const sb = createClient();
      const { data: { user: u } } = await sb.auth.getUser();
      if (!u) throw new Error("not-signed-in");
      const region = regions.find((r) => r.id === regionId);

      const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
        wordAudio ? upload(sb, u.id, "word", wordAudio) : Promise.resolve(null),
        sentenceAudio ? upload(sb, u.id, "sentence", sentenceAudio) : Promise.resolve(null),
      ]);

      const { error: insErr } = await sb.from("spik_word_variations").insert({
        word_id: wordId,
        region_id: regionId,
        region_name: region?.name ?? "",
        variant_spelling: spelling.trim() || null,
        pronunciation: pronunciation.trim() || null,
        word_audio_url: wordAudioUrl,
        sentence_text: sentence.trim() || null,
        sentence_audio_url: sentenceAudioUrl,
        contributor_id: u.id,
        contributor_name: displayName.trim() || null,
        show_name: showName,
        status: "pending",
      });
      if (insErr) throw insErr;
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(
        (err as Error)?.message === "not-signed-in"
          ? "Please sign in and try again."
          : "Something went wrong — please try again in a moment.",
      );
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-ink outline-none focus:border-spik";

  // Still checking session
  if (user === undefined) {
    return <div className="rounded-xl border border-line bg-paper p-8 text-center text-ink-muted shadow-soft">Loading…</div>;
  }

  // Signed-out gate — adding audio requires an account.
  if (user === null) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
        <h2 className="font-display text-xl font-bold text-ink">Sign in to add a variation</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Adding a local spelling and your own audio needs an account, so we can credit you and keep recordings trustworthy.
        </p>
        <Link
          href={`/sign-in?next=/spik/${wordId}/add-variation`}
          className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper"
          style={{ background: SPIK_COLOR }}
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: SPIK_COLOR }} aria-hidden>✓</span>
        <h2 className="mt-5 font-display text-2xl font-bold">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Your variation of &ldquo;{word}&rdquo; has been sent for review. Once it&apos;s approved it&apos;ll appear on this word&apos;s page under your region.
        </p>
        <Link href={`/spik/${wordId}`} className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: SPIK_COLOR }}>
          Back to the word
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Region — required */}
      <div className="rounded-xl border-2 bg-paper p-5 shadow-soft" style={{ borderColor: SPIK_COLOR }}>
        <label className="font-display text-lg font-bold" htmlFor="region">
          Whaur in Shetland? <span style={{ color: SPIK_COLOR }}>*</span>
        </label>
        <p className="mt-1 text-sm text-ink-muted">The part of Shetland this spelling / pronunciation is from.</p>
        {regions.length === 0 ? (
          <p className="mt-3 text-sm text-rose-600">No regions are set up yet — ask an admin to add them in Control Centre.</p>
        ) : (
          <select id="region" value={regionId} onChange={(e) => setRegionId(e.target.value)} className={inputCls + " mt-3"}>
            <option value="">Choose a region…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Spelling + written pronunciation */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <label className="font-semibold text-ink" htmlFor="spelling">Local spelling</label>
        <p className="mt-0.5 text-xs text-ink-muted">How &ldquo;{word}&rdquo; is spelled whaur you&apos;re fae (leave blank if it&apos;s the same).</p>
        <input id="spelling" value={spelling} onChange={(e) => setSpelling(e.target.value)} placeholder={word} className={inputCls + " mt-3 text-lg"} />
        <label className="mt-4 block font-semibold text-ink" htmlFor="pron">Pronunciation <span className="text-xs font-normal text-ink-faint">· optional</span></label>
        <p className="mt-0.5 text-xs text-ink-muted">Written out, e.g. AHB-er (caps = stressed syllable).</p>
        <input id="pron" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} placeholder="…" className={inputCls + " mt-3"} />
      </div>

      {/* Audio: the word */}
      <AudioInput
        label="Hear the word"
        hint="Record yourself saying the word the wey you say it, or upload a clip."
        value={wordAudio}
        onChange={setWordAudio}
      />

      {/* Example sentence + its audio */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <label className="font-semibold text-ink" htmlFor="sentence">Example sentence <span className="text-xs font-normal text-ink-faint">· optional</span></label>
        <p className="mt-0.5 text-xs text-ink-muted">A natural sentence using the word.</p>
        <textarea id="sentence" value={sentence} onChange={(e) => setSentence(e.target.value)} rows={2} placeholder="…" className={inputCls + " mt-3"} />
      </div>
      <AudioInput
        label="Hear the sentence"
        hint="Record yourself saying that sentence, or upload a clip."
        value={sentenceAudio}
        onChange={setSentenceAudio}
      />

      {/* Attribution */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-bold">Your name</h3>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name (optional)" className={inputCls + " mt-3"} />
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-ink">Show my name on this variation</span>
            <span className="block text-xs text-ink-muted">{showName ? "Your name appears as the contributor" : "Your contribution stays anonymous"}</span>
          </span>
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-5 w-5 accent-spik" />
        </label>
      </div>

      {error && <p className="text-center text-sm font-semibold text-rose-600">{error}</p>}

      <button type="submit" disabled={status === "saving"}
        className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: SPIK_COLOR }}>
        {status === "saving" ? "Sending…" : "Send this variation for review"}
      </button>
      <p className="px-4 text-center text-xs leading-relaxed text-ink-muted">
        Variations are checked by a moderator before they go live. Shetland dialect belongs to everyone — thank you for helping keep every corner of it alive.
      </p>
    </form>
  );
}
