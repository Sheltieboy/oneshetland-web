/**
 * load.server.ts — the Fetch v2 page loaders (SERVER-ONLY). Pages stay thin: sign-in check, one load here, one view component.
 * Every read goes through lib/fetch-api.ts with the member's own session, so the database decides what each person may see.
 */
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { fetchApi } from "@/lib/fetch/transport.server";
import { headerSummary, type HeaderSummary } from "@/lib/fetch/header";
import type { RequesterJobData } from "@/components/fetch/v2/RequesterJob";
import type { DriverJobData } from "@/components/fetch/v2/DriverJob";

export async function requireMember(next: string) {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return account;
}

/** One job, for whichever party is asking. Not a party (or not found) → null, and the page shows "not found". */
export async function loadJob(id: string): Promise<{ viewer: "requester"; data: RequesterJobData } | { viewer: "driver"; data: DriverJobData } | null> {
  const api = await fetchApi();
  const detail = await api.detail(id);
  if (!detail.ok || (detail.data.viewer !== "requester" && detail.data.viewer !== "driver")) return null;
  const [timeline, messages, photos, issues] = await Promise.all([api.timeline(id), api.messages(id), api.photos(id), api.myIssues(id)]);
  const common = {
    now: Date.now(), detail: detail.data, timeline: timeline.ok ? timeline.data : [], messages: messages.ok ? messages.data : null,
    photos: photos.ok ? photos.data.photos : [], issues: issues.ok ? issues.data.issues : [],
  };
  if (detail.data.viewer === "driver") {
    const [jobs, elig] = await Promise.all([api.myJobs(), api.eligibility()]);
    return { viewer: "driver", data: { ...common, pay: jobs.ok ? jobs.data.find((j) => j.id === id)?.pay ?? null : null,
      driverProblem: elig.ok ? elig.data.driver_problem : null } };
  }
  const hint = detail.data.request.status === "pending" ? await api.headingThatWay(id) : null;
  return { viewer: "requester", data: { ...common, hint: hint?.ok ? hint.data : null } };
}

/** The header chip's summary of the member's live Fetches (v2), or null. Never throws: the header must always render. */
export async function getFetchHeaderSummary(): Promise<HeaderSummary> {
  try {
    const r = await (await fetchApi()).myRequests();
    return r.ok ? headerSummary(r.data) : null;
  } catch { return null; }
}

