import { redirect } from "next/navigation";

/** The old Operations screen showed Fetch v1 deliveries, runs and waiting-fee disputes, and let an admin rewrite a waiting fee straight
 *  in the table. Fetch v2 keeps every money change an audited server action, in Fetch operations (Step 10); this address forwards there
 *  (Fetch v2 Step 14A). The old screen is kept for reference in legacy/fetch-v1/. */
export default function Page() {
  redirect("/admin/fetch");
}
