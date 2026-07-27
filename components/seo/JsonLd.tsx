/**
 * Renders a JSON-LD structured-data <script>. Server-safe; escapes `<` to avoid
 * XSS via injected content (per the Next.js JSON-LD guidance).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
