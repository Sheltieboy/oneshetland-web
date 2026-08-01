import { listSocialPosts, listSocialRecipes } from "@/lib/social-admin.server";
import { SocialStudio } from "@/components/admin/SocialStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social studio · Admin" };

export default async function AdminSocialPage() {
  const [posts, recipes] = await Promise.all([listSocialPosts(), listSocialRecipes()]);
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy">Social studio</h1>
        <p className="text-sm text-ink-soft">
          Peerie Press drafts posts from what&apos;s happening on OneShetland — review, tweak and approve;
          the publisher sends approved posts to the Facebook Page on schedule.
        </p>
      </div>
      <SocialStudio posts={posts} recipes={recipes} />
    </div>
  );
}
