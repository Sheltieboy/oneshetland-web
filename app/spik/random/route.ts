import { redirect } from "next/navigation";
import { getRandomWordSlug } from "@/lib/spik-data";

export const dynamic = "force-dynamic";

/** "Surprise me" — bounce to a random word, or back to the dictionary. */
export async function GET() {
  const slug = await getRandomWordSlug();
  redirect(slug ? `/spik/${slug}` : "/spik");
}
