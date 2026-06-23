import { redirect } from "next/navigation";
import { getRandomWordId } from "@/lib/spik-data";

export const dynamic = "force-dynamic";

/** "Surprise me" — bounce to a random word, or back to the dictionary. */
export async function GET() {
  const id = await getRandomWordId();
  redirect(id ? `/spik/${id}` : "/spik");
}
