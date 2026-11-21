"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  SPIK_COLOR,
  REGION_CONFIDENCE_OPTIONS,
  cleanContributorNote,
  type RegionConfidence,
} from "@/lib/spik-data";
import { AudioInput } from "@/components/spik/AudioInput";
import { ContributorNoteField } from "@/components/spik/ContributorNoteField";

type Region = { id: string; slug: string; name: string };

/** The "I'm not sure" choice in the area list: the variation is sent with no area and a Spik editor chooses one. */
const NOT_SURE = "not-sure";

/**
 * AddVariationForm — a signed-in contributor records how a word is said and
 * spelled in their part of Shetland: a region, an optional variant spelling +
 * written pronunciation, an audio clip of them saying the word, and an example
 * sentence with its own clip. Audio uploads to the `spik-audio` bucket; the row
 * lands in spik_word_variations as 'pending' for a moderator to approve.
 *
 * Region: the variation still has ONE public region (the word page groups by it).
 * Anything more the contributor knows — other areas they've heard it in, that
 * it's a mix of influences, or that they're not sure — plus the free-text
 * "Additional information" goes to spik_word_variation_notes, which only the
 * Spik editors can read. It is never published.
 *
 * "I'm not sure": a contributor who can't honestly pick one area can choose that instead. The
 * variation is sent with no area (region_id null) and stays pending until an editor chooses one
 * from the existing list — the database refuses to approve a variation without an area.
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
  // Private, editors-only detail (spik_word_variation_notes).
  const [alsoRegionIds, setAlsoRegionIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<RegionConfidence>("this_area");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [noteSaveFailed, setNoteSaveFailed] = useState(false);

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

  const unsure = regionId === NOT_SURE;

  function chooseRegion(value: string) {
    setError(null);
    setRegionId(value);
    setAlsoRegionIds((ids) => ids.filter((i) => i !== value));
    if (value === NOT_SURE) setConfidence("not_sure");
    else if (confidence === "not_sure" && regionId === NOT_SURE) setConfidence("this_area");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regionId) {
      setError("Please choose the part of Shetland you most connect this with, or \u201cI\u2019m not sure\u201d.");
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
      const region = unsure ? undefined : regions.find((r) => r.id === regionId);
      // Chosen here (not by the database) so the private note can be linked to this variation without
      // reading the pending row back — contributors cannot read pending rows through the API.
      const variationId = crypto.randomUUID();

      const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
        wordAudio ? upload(sb, u.id, "word", wordAudio) : Promise.resolve(null),
        sentenceAudio ? upload(sb, u.id, "sentence", sentenceAudio) : Promise.resolve(null),
      ]);

      const { error: insErr } = await sb.from("spik_word_variations").insert({
        id: variationId,
        word_id: wordId,
        region_id: region?.id ?? null, // null = "I'm not sure": an editor chooses the area before approving
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

      // Private detail for the editors — only when there is something to tell them.
      const privateNote = cleanContributorNote(note);
      const also = alsoRegionIds.filter((id) => id !== regionId);
      const regionConfidence: RegionConfidence = unsure ? "not_sure" : confidence;
      if (privateNote || also.length > 0 || regionConfidence !== "this_area") {
        const { error: noteErr } = await sb.from("spik_word_variation_notes").insert({
          variation_id: variationId,
          contributor_id: u.id,
          note: privateNote,
          also_region_ids: also,
          region_confidence: regionConfidence,
        });
        if (noteErr) {
          // The variation itself is safely with the editors; only the extra detail failed.
          setNoteSaveFailed(true);
        }
      }
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
          {unsure
            ? <>Your variation of &ldquo;{word}&rdquo; has been sent for review. A Spik editor will decide which area it belongs under before it appears on this word&apos;s page.</>
            : <>Your variation of &ldquo;{word}&rdquo; has been sent for review. Once it&apos;s approved it&apos;ll appear on this word&apos;s page under your region.</>}
        </p>
        {noteSaveFailed && (
          <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-rose-600">
            We couldn&apos;t save your additional information, but your variation was sent. If it matters, please add it as a suggestion on this word.
          </p>
        )}
        <Link href={`/spik/${wordId}`} className="mt-6 inline-block rounded-pill px-5 py-3 font-semibold text-paper" style={{ background: SPIK_COLOR }}>
          Back to the word
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Region — one public region (required), plus private detail for the editors */}
      <div className="rounded-xl border-2 bg-paper p-5 shadow-soft" style={{ borderColor: SPIK_COLOR }}>
        <label className="font-display text-lg font-bold" htmlFor="region">
          Where in Shetland? <span style={{ color: SPIK_COLOR }}>*</span>
        </label>
        <p className="mt-1 text-sm text-ink-muted">
          Choose the area you most connect this spelling or pronunciation with. If you can&apos;t pick one, choose &ldquo;I&apos;m not sure&rdquo; and a Spik editor will decide.
        </p>
        {regions.length === 0 ? (
          <p className="mt-3 text-sm text-rose-600">No regions are set up yet — ask an admin to add them in Control Centre.</p>
        ) : (
          <select id="region" value={regionId} onChange={(e) => chooseRegion(e.target.value)} className={inputCls + " mt-3"}>
            <option value="">Choose a region…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
            <option value={NOT_SURE}>I&apos;m not sure — let the Spik editors decide</option>
          </select>
        )}

        {regions.length > 0 && (
          <>
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">
                {unsure ? "Any areas you\u2019ve heard it in?" : "Heard in other areas too?"} <span className="text-xs font-normal text-ink-faint">· optional</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {regions.filter((r) => r.id !== regionId).map((r) => {
                  const on = alsoRegionIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAlsoRegionIds((ids) => (on ? ids.filter((i) => i !== r.id) : [...ids, r.id]))}
                      className={"rounded-pill border px-3 py-1.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line bg-cream/40 text-ink-soft hover:border-spik")}
                      style={on ? { background: SPIK_COLOR, borderColor: SPIK_COLOR } : undefined}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {!unsure && (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">How would you describe where it comes from?</legend>
              <div className="mt-2 space-y-2">
                {REGION_CONFIDENCE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-3 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name="region-confidence"
                      value={o.value}
                      checked={confidence === o.value}
                      onChange={() => setConfidence(o.value)}
                      className="h-4 w-4 accent-spik"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            )}

            <p className="mt-4 text-xs leading-relaxed text-ink-muted">
              {unsure
                ? <>Your variation won&apos;t appear on the word&apos;s page until a Spik editor has chosen an area for it. Any areas you pick here are only seen by the editors.</>
                : <>Only the area chosen above appears on the word&apos;s page. The other areas and your answer here are only seen by the Spik editors.</>}{" "}
              Places that aren&apos;t on the list can go in &ldquo;Additional information&rdquo; below.
            </p>
          </>
        )}
      </div>

      {/* Spelling + written pronunciation */}
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <label className="font-semibold text-ink" htmlFor="spelling">Local spelling</label>
        <p className="mt-0.5 text-xs text-ink-muted">How &ldquo;{word}&rdquo; is spelled where you&apos;re from (leave blank if it&apos;s the same).</p>
        <input id="spelling" value={spelling} onChange={(e) => setSpelling(e.target.value)} placeholder={word} className={inputCls + " mt-3 text-lg"} />
        <label className="mt-4 block font-semibold text-ink" htmlFor="pron">Pronunciation <span className="text-xs font-normal text-ink-faint">· optional</span></label>
        <p className="mt-0.5 text-xs text-ink-muted">Written out, e.g. AHB-er (caps = stressed syllable).</p>
        <input id="pron" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} placeholder="…" className={inputCls + " mt-3"} />
      </div>

      {/* Audio: the word */}
      <AudioInput
        label="Hear the word"
        hint="Record yourself saying the word the way you say it, or upload a clip."
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

      {/* Private note to the editors */}
      <ContributorNoteField value={note} onChange={setNote} id="variation-contributor-note" />

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
