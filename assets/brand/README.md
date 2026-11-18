# Brand files the server reads

`apple-icon.png` and `opengraph-image.png` are the originals, moved here from `app/` unchanged. They
used to be Next's file-convention icons; they now sit behind `app/apple-icon.ts` and
`app/opengraph-image.ts`, which pick between them and the `-festive` pair by the date (see
`lib/festive.ts`). Nothing about the artwork changed.

`*-festive.png` are derived from `public/brand/festive/logo-mark-festive-master-1254.png`, the
supplied festive mark. `scripts/gen-festive-brand.md` has the recipe. The festive apple icon and
social card reproduce the originals' geometry exactly — same cream ground, same ring span, same
centre, same type and colour bar — so only the mark itself differs.

## Keep this folder to four PNGs

Both routes build their path with `join(process.cwd(), "assets", "brand", name)` where `name` is
decided at runtime. The file tracer cannot follow that, so it conservatively bundles everything whose
path begins `assets/brand` into BOTH deployed functions — the entries in `outputFileTracingIncludes`
only make that certain. It is why the 2.2MB festive master lives in `public/brand/festive/` beside
the derivative it produced, and not here: an `assets/brand/master/` folder, and then an
`assets/brand-master/` one, both still ended up inside the functions.
