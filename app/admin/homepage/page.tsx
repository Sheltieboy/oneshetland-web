import { getHomeContent } from "@/lib/home-data";
import { AdminHeader, Empty } from "@/components/admin/AdminUI";
import { HomeContentForm } from "@/components/admin/HomeContentForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const content = await getHomeContent();
  return (
    <>
      <AdminHeader title="Homepage" sub="Edit the welcome copy, featured image and spotlight tiles shown on the public homepage. Images upload to the site-media bucket." />
      {content ? <HomeContentForm initial={content} /> : <Empty>Homepage content isn&apos;t set up yet — the migration seeds a row, so try again after it runs.</Empty>}
    </>
  );
}
