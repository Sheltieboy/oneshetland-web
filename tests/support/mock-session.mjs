// Prints a Supabase SSR auth cookie value for a mock-postgrest member fixture. Rendering aid only.
//   node tests/support/mock-session.mjs <fixture> [supabase-url]   → "<cookie-name> <cookie-value>"
const fx = process.argv[2] ?? "none";
const url = new URL(process.argv[3] ?? "http://localhost:3099");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ fx, sub: "x", aud: "authenticated", role: "authenticated", exp })}.sig`;
const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user: { id: "x", aud: "authenticated", role: "authenticated", email: "member@example.com" } };
console.log(`sb-${url.hostname.split(".")[0]}-auth-token base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`);
