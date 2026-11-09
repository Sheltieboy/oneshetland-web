import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { AnnouncementsAdmin } from "@/components/admin/AnnouncementsAdmin";
import { ANNOUNCEMENT_COLUMNS, readAnnouncements } from "@/lib/home-announcements";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements · Admin" };

/** Admin → Announcements: manage "Latest from OneShetland". The admin layout already requires an administrator; the database enforces it again (RLS). */
export default async function Page() {
  const sb = await createClient();
  const { data, error } = await sb.from("home_announcements").select(ANNOUNCEMENT_COLUMNS).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(500);
  return (
    <>
      <AdminHeader title="Announcements" sub="Latest from OneShetland on the homepage: What's new and Did you know? stories. The first live story is the featured one." />
      {error
        ? <Empty>{error.code === "42P01" || /home_announcements/.test(error.message) ? "Announcements are not set up yet: the database migration (20270101000000_home_announcements) has not been applied." : `Could not load announcements: ${error.message}`}</Empty>
        : <AnnouncementsAdmin initial={readAnnouncements(data)} />}
    </>
  );
}
