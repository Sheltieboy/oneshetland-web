import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: string;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  location_area: string | null;
  is_active: boolean;
};

export type Account = {
  id: string;
  email: string | null;
  profile: Profile | null;
};

/** The signed-in user + their profile, for Server Components. Null if signed out. */
export async function getAccount(): Promise<Account | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, full_name, display_name, phone, avatar_url, bio, location_area, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, email: user.email ?? null, profile: (profile ?? null) as Profile | null };
}

/** A friendly display name for the header / greetings. */
export function accountName(a: Account | null): string {
  if (!a) return "";
  return a.profile?.display_name || a.profile?.full_name || a.email?.split("@")[0] || "Member";
}
