/** The block vocabulary, in the editor, so an organiser never needs to be told it exists. */
const ROWS: [string, string, string][] = [
  ["A big opening sentence", "::: lede", "Your opening line, set large."],
  ["A photograph", "::: figure src=… alt=\"…\" ratio=16x9", "caption=\"…\" is optional. Ratios: 16x9, 4x3, 3x4, 1x1."],
  ["A full-width photograph with a headline over it", "::: band src=… alt=\"…\" align=centre", "Use a landscape picture. Leave src off for a plain coloured band."],
  ["A photograph beside text", "::: split src=… alt=\"…\" side=left", "side=left or right. Portrait pictures suit this one."],
  ["A row of cards", "::: cards", "Then one line each: - [Title](/link) — short description"],
  ["A call to action", "::: cta href=/whats-on/add label=\"Add your event\"", "The words go inside; the button is the label."],
];
export function BlockGuide() {
  return (
    <details className="mt-4 rounded-card border border-line bg-cream/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Blocks you can use on a page</summary>
      <p className="mt-2 text-xs text-ink-muted">
        Start a block on its own line and close it with <code className="font-mono">:::</code> on its own line.
        Anything between is ordinary text. A page with no blocks looks exactly as it always has.
      </p>
      <dl className="mt-3 space-y-3">
        {ROWS.map(([what, open, note]) => (
          <div key={what}>
            <dt className="text-xs font-semibold text-ink">{what}</dt>
            <dd className="mt-1">
              <code className="block overflow-x-auto rounded bg-paper p-2 font-mono text-[11px] text-ink">{open}{"\n…\n:::"}</code>
              <span className="mt-1 block text-[11px] text-ink-muted">{note}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-ink-muted">
        Add <code className="font-mono">focus=&quot;50% 30%&quot;</code> to a photograph to choose which part stays in frame when it is cropped.
      </p>
    </details>
  );
}
