"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Real web account-deletion flow. Two-step confirm → calls the `delete-account`
 * edge function (which removes the user's data and soft-deletes the auth user),
 * then signs out and returns home.
 */
export function DeleteAccountForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
        <p className="text-ink-soft">
          Please{" "}
          <a href="/sign-in?next=/delete-account" className="font-semibold text-teal-dark underline">sign in</a>{" "}
          to delete your account here. If you can&rsquo;t sign in, see &ldquo;Can&rsquo;t access the app?&rdquo; below.
        </p>
      </div>
    );
  }

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Your session has expired — please sign in again and retry.");
      const { data, error: fnErr } = await sb.functions.invoke("delete-account", { body: {} });
      const errMsg = (data as { error?: string } | null)?.error;
      if (fnErr || errMsg) throw new Error(errMsg ?? fnErr?.message ?? "Could not delete your account.");
      await sb.auth.signOut();
      router.replace("/?account_deleted=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-5 shadow-soft">
      {stage === 0 && (
        <>
          <p className="font-display text-lg font-bold text-ink">Delete your account</p>
          <p className="mt-1 text-sm text-ink-soft">Permanently removes your account and personal data. This can&rsquo;t be undone.</p>
          <button onClick={() => setStage(1)} className="mt-4 rounded-pill bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95">
            Delete my account
          </button>
        </>
      )}

      {stage === 1 && (
        <>
          <p className="font-bold text-ink">Are you sure?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Your profile, content, saved cards, follows and settings will be permanently deleted. Order and payment records are kept in anonymised form for legal reasons (see below).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setStage(2)} className="rounded-pill bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95">Yes, continue</button>
            <button onClick={() => setStage(0)} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand">Cancel</button>
          </div>
        </>
      )}

      {stage === 2 && (
        <>
          <p className="font-bold text-ink">Final confirmation</p>
          <p className="mt-1 text-sm text-ink-soft">Type <span className="font-mono font-bold text-ink">DELETE</span> below to permanently delete your account.</p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="auth-input mt-3 max-w-xs"
          />
          {error && <p className="mt-2 rounded-lg bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={doDelete}
              disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}
              className="rounded-pill bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              onClick={() => { setStage(0); setConfirmText(""); setError(null); }}
              disabled={busy}
              className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
