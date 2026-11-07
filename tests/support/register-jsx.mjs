// Test-only: the normal test loader PLUS a .tsx transform (TypeScript's own transpiler, react-jsx) and light stand-ins for next/link, next/image and
// next/navigation, so real server/client components can be rendered to static HTML with react-dom/server. Nothing here is shipped.
import "./register.mjs";
import { register } from "node:module";
register("./loader-jsx.mjs", import.meta.url);
