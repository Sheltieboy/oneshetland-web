import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, type Account } from "@/lib/auth";

export type CheckInEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  locality: string | null;
};

/** Non-redirecting check: can the signed-in user check in attendees for this
 *  event? Used to conditionally show the "Check in attendees" link. */
export async function canScanEvent(eventId: string): Promise<boolean> {
  const account = await getAccount();
  if (!account) return false;
  const sb = await createClient();
  const { data: ev } = await sb
    .from("events")
    .select("organiser_user_id, organiser_business_id, organiser_hub_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return false;
  const owns = ev as Record<string, unknown>;
  if (account.profile?.role === "admin") return true;
  if (owns.organiser_user_id === account.id) return true;
  if (owns.organiser_business_id) {
    const { data: biz } = await sb
      .from("local_businesses").select("owner_id")
      .eq("id", owns.organiser_business_id as string).maybeSingle();
    if ((biz as { owner_id?: string } | null)?.owner_id === account.id) return true;
  }
  if (owns.organiser_hub_id) {
    const { data: isHubAdmin } = await sb.rpc("is_hub_admin", { p_hub: owns.organiser_hub_id, p_user: account.id });
    if (isHubAdmin) return true;
  }
  return false;
}

/**
 * Gate a check-in route to someone authorised to scan tickets for an event.
 *
 * Mirrors the authorisation the `validate-event-ticket` edge function enforces:
 * an admin, the event's organiser_user, the owning business's owner, or a hub
 * admin of the organiser hub. The edge function re-checks this server-side, so
 * this gate is the UX layer (it just avoids rendering the tool to non-owners).
 */
export async function requireEventScanner(
  eventId: string,
): Promise<{ event: CheckInEvent; account: Account }> {
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/whats-on/${eventId}/check-in`);

  const sb = await createClient();

  const { data: ev } = await sb
    .from("events")
    .select(
      "id, title, starts_at, venue, locality, organiser_user_id, organiser_business_id, organiser_hub_id",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!ev) notFound();
  const owns = ev as Record<string, unknown>;

  let authorised = account.profile?.role === "admin";
  if (!authorised && owns.organiser_user_id === account.id) authorised = true;
  if (!authorised && owns.organiser_business_id) {
    const { data: biz } = await sb
      .from("local_businesses")
      .select("owner_id")
      .eq("id", owns.organiser_business_id as string)
      .maybeSingle();
    authorised = (biz as { owner_id?: string } | null)?.owner_id === account.id;
  }
  if (!authorised && owns.organiser_hub_id) {
    const { data: isHubAdmin } = await sb.rpc("is_hub_admin", {
      p_hub: owns.organiser_hub_id,
      p_user: account.id,
    });
    authorised = !!isHubAdmin;
  }

  if (!authorised) redirect(`/whats-on/${eventId}`);

  return {
    event: {
      id: owns.id as string,
      title: owns.title as string,
      starts_at: owns.starts_at as string,
      venue: (owns.venue as string | null) ?? null,
      locality: (owns.locality as string | null) ?? null,
    },
    account,
  };
}
