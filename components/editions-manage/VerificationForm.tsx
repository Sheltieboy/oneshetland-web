"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestVerification } from "@/app/organise/actions";
import { verificationEvidence } from "@/lib/editions/validate";
import { Field, Notice, btnPrimary, inputCls } from "./kit";
import { useAction } from "./use-action";

export function VerificationForm({ slug, resubmit }: { slug: string; resubmit?: boolean }) {
  const router = useRouter();
  const { pending, msg, run, setMsg } = useAction();
  const [text, setText] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = verificationEvidence(text);
    if (!v.ok) return setMsg({ ok: false, text: v.error });
    run(() => requestVerification(slug, text), { success: "Thank you. We have your request and will be in touch.", onOk: () => { setText(""); router.refresh(); } });
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Tell us about your organisation" htmlFor="v-evidence" hint="For example who runs the event, how long it has run, and a website or social page we can look at. At least 10 characters.">
        <textarea id="v-evidence" className={inputCls} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
      </Field>
      <Notice msg={msg} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Sending…" : resubmit ? "Send again" : "Request verification"}</button>
    </form>
  );
}
