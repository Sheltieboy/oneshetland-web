// Test-only module loader: lets `node --test` execute real app modules that use the "@/" alias and
// extensionless relative imports, and swaps the Supabase client for an in-memory fake
// (tests/support/fake-supabase.mjs). Nothing here is shipped, and nothing can reach a network.
//   node --test --import ./tests/support/register.mjs tests/event-visibility.test.mjs
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
