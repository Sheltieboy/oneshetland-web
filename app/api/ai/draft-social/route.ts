import Anthropic from "@anthropic-ai/sdk";
import { guardAi, aiProviderFailure } from "@/lib/ai-guard.server";
import { isAdmin } from "@/lib/admin-data.server";
import { ONESHETLAND_CONTEXT } from "@/lib/peerie-bot-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/draft-social  { seed: string, words?: number }
 *
 * Peerie Bot writes a Facebook caption for the Social studio's "Write a post"
 * box from a seed word/phrase/topic ("ferry disruption tonight", "thank you
 * for 500 followers", "gansey"). `words` is a rough length target. Returns a
 * caption for the admin to edit and approve — nothing posts directly from
 * here. Admin-only; ANTHROPIC_API_KEY stays server-side.
 */

export async function POST(request: Request) {
  // Signed in, sized, and inside quota first — admin or not, this route spends
  // the Anthropic key, and an admin account is still a single credential that
  // should not be able to run it in a loop for ever.
  const gate = await guardAi(request, { route: "draft-social", maxBodyBytes: 8_000, maxFieldChars: 500 });
  if (!gate.ok) return gate.response;

  // Authorisation, on top of authentication: this one is admin-only.
  if (!(await isAdmin())) return Response.json({ error: "Not allowed." }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });

  const seed = String(gate.body.seed ?? "").trim();
  const words = Math.min(Math.max(Number(gate.body.words) || 40, 10), 200);
  if (!seed) return Response.json({ error: "Give Peerie Bot a word or phrase to work from." }, { status: 400 });

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      system:
        "You write Facebook posts for OneShetland, the community app and website for the Shetland Isles — as a real person running a local page, not a brand. " +
        "Voice: warm, plain-spoken, standard English. Shetland dialect may appear only as quoted content being featured, never as your own copy. " +
        "Write ONLY from what the admin's seed says — never invent events, dates, times, prices, names or claims that aren't in the seed. " +
        "If a link belongs, use https://oneshetland.com (or a path the seed gives you); otherwise no link. " +
        "At most 2 emoji, often none. No hashtag walls — at most 2 genuinely useful ones, usually none. " +
        "Reply with the post text only — no quotes, no preamble.\n\n" +
        ONESHETLAND_CONTEXT,
      messages: [{
        role: "user",
        content: `Today is ${today}.\nRough length: about ${words} words.\n\nWrite a OneShetland Facebook post from this seed:\n${seed}`,
      }],
    });
    const caption = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    if (!caption) return Response.json({ error: "Peerie Bot came back empty — try again." }, { status: 502 });
    return Response.json({ caption });
  } catch (err) {
    console.error("[draft-social] failed:", err);
    return Response.json({ error: "Peerie Bot had a moment — try again." }, { status: 502 });
  }
}
