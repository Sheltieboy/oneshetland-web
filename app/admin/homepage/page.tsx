import { getHomeContent } from "@/lib/home-data";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { HomeContentForm } from "@/components/admin/HomeContentForm";
import { HomepageShowcaseControl, type ExclusionRow } from "@/components/admin/HomepageShowcaseControl";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const content = await getHomeContent();
  // Businesses an administrator has asked to keep out of the homepage showcase. A failed read must not hide the whole page.
  const exclusions: ExclusionRow[] = await createClient()
    .then((sb) => sb.rpc("admin_homepage_exclusions"))
    .then((r) => ((r.data ?? []) as ExclusionRow[]))
    .catch(() => []);
  return (
    <>
      <AdminHeader title="Homepage" sub="Edit the welcome copy, featured image and spotlight tiles shown on the public homepage. Images upload to the site-media bucket." />
      {content ? <HomeContentForm initial={content} /> : <Empty>Homepage content isn&apos;t set up yet — the migration seeds a row, so try again after it runs.</Empty>}
      <HomepageShowcaseControl initial={exclusions} />
    </>
  );
}
