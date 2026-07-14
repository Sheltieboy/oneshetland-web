import { getAccount } from "@/lib/auth";
import { ProfileEditForm } from "@/components/account/ProfileEditForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function Page() {
  const account = (await getAccount())!;
  const p = account.profile;
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-ink">Edit profile</h1>
      <p className="mt-1 text-ink-soft">This is the same profile you use across OneShetland — app and web.</p>
      <div className="mt-6">
        <ProfileEditForm
          userId={account.id}
          initial={{
            full_name: p?.full_name ?? "", display_name: p?.display_name ?? "", bio: p?.bio ?? "",
            location_area: p?.location_area ?? "", phone: p?.phone ?? "", avatar_url: p?.avatar_url ?? "",
            games_handle: (p as { games_handle?: string | null })?.games_handle ?? "",
          }}
        />
      </div>
    </div>
  );
}
