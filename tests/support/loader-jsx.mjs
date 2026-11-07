import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const STUB = new URL("./next-stubs.mjs", import.meta.url).href;
const STUBS = { "next/link": STUB, "next/image": new URL("./next-image-stub.mjs", import.meta.url).href, "next/navigation": STUB, "react-dom": new URL("./react-dom-stub.mjs", import.meta.url).href };

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith("file:") && url.endsWith(".tsx")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false }, fileName: url });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
