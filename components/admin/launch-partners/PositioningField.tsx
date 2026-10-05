"use client";

import { useState } from "react";
import { savePositioningAction } from "@/app/admin/launch-partners/actions";
import { Field, SaveBar, inputCls } from "./fields";

export function PositioningField({ id, initial }: { id: string; initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <Field label="Positioning"><input className={inputCls} value={v} maxLength={200} onChange={(e) => setV(e.target.value)} placeholder="e.g. Products + experiences" /></Field>
      <SaveBar onSave={async () => { const r = await savePositioningAction(id, v); return r.ok ? null : r.error; }} />
    </>
  );
}
