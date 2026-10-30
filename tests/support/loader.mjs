import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FAKE = pathToFileURL(join(ROOT, "tests/support/fake-supabase.mjs")).href;
const STUB = pathToFileURL(join(ROOT, "tests/support/empty-stub.mjs")).href;

function withExt(p) {
  for (const c of [p, p + ".ts", p + ".tsx", join(p, "index.ts")]) if (existsSync(c) && !c.endsWith("/") && /\.[a-z]+$/.test(c)) return c;
  return null;
}

export async function resolve(specifier, context, next) {
  // Anything that would build a real Supabase client becomes the in-memory fake.
  if (/(^|\/)supabase\/(public|server|client)(\.ts)?$/.test(specifier) || /^@\/lib\/supabase\/(public|server|client)$/.test(specifier)) {
    return { url: FAKE, shortCircuit: true };
  }
  if (specifier === "server-only" || specifier === "next/headers" || specifier === "next/navigation") return { url: STUB, shortCircuit: true };
  let p = null;
  if (specifier.startsWith("@/")) p = withExt(join(ROOT, specifier.slice(2)));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    p = withExt(join(dirname(fileURLToPath(context.parentURL)), specifier));
  }
  if (p) return { url: pathToFileURL(p).href, shortCircuit: true };
  return next(specifier, context);
}
