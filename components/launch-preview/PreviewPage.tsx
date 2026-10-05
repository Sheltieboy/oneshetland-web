import type { ReactNode } from "react";
import type { PreviewConfig, PreviewProduct } from "@/lib/launch-preview/types";
import type { DirectoryFacts } from "@/lib/launch-preview/directory";
import { ClaimCta } from "./ClaimCta";

/**
 * The Launch Partner Preview page. Every business-specific word and picture comes from PreviewConfig (and the
 * business's own Directory record); this component holds only the shared OneShetland story. Server component — the
 * one interactive piece is the claim button, which makes no request.
 *
 * Palette: navy / coral / teal / lime on the warm editorial surface, Fraunces display type.
 */

const NAVY = "#032f4c";
const CORAL = "#ff6b57";
const TEAL = "#12b3d6";
const LIME = "#c8f169";

const gbp = (n: number) => `£${n.toFixed(2)}`;

/** Trim to whole sentences within `max` characters (the Directory text can be long). */
function shorten(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/* ── small pieces ─────────────────────────────────────────────────────── */

function Lock({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function Img({ src, alt, className = "", style, eager = false }: { src: string; alt: string; className?: string; style?: React.CSSProperties; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className={className} style={style} />;
}

/** The business's own photo, filling its frame. */
function Shopfront({ cfg, className = "", eager = false }: { cfg: PreviewConfig; className?: string; eager?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Img eager={eager} src={cfg.business.image.src} alt={cfg.business.image.alt} className="absolute inset-0 h-full w-full object-cover" />
    </div>
  );
}

const PreviewTag = ({ children = "Preview", dark = false }: { children?: ReactNode; dark?: boolean }) => (
  <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider " + (dark ? "bg-white/20 text-white" : "bg-[#032f4c]/90 text-white")}>{children}</span>
);

function Section({ id, eyebrow, title, children, tone = "cream", className = "" }: { id?: string; eyebrow?: string; title?: ReactNode; children: ReactNode; tone?: "cream" | "sand" | "white" | "navy"; className?: string }) {
  const bg = { cream: "bg-transparent", sand: "bg-[#f3ece0]", white: "bg-white", navy: "text-white" }[tone];
  return (
    <section id={id} className={`relative ${bg} ${className}`} style={tone === "navy" ? { background: `linear-gradient(135deg, ${NAVY}, #0a4a70 62%, #12667a)` } : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        {eyebrow && <p className="eyebrow" style={{ color: tone === "navy" ? LIME : "#0e9ab8" }}>{eyebrow}</p>}
        {title && <h2 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>}
        <div className={title || eyebrow ? "mt-8 sm:mt-10" : ""}>{children}</div>
      </div>
    </section>
  );
}

/* ── 1. private header ────────────────────────────────────────────────── */

function PrivateBar({ name }: { name: string }) {
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 text-white" style={{ background: NAVY }} role="note" aria-label="This is a private preview. Nothing is live.">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="truncate">Private preview · {name}</span>
        </p>
        <span className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: CORAL }}><span className="sm:hidden">Not live</span><span className="hidden sm:inline">Nothing is live</span></span>
      </div>
    </div>
  );
}

/* ── 2. hero ──────────────────────────────────────────────────────────── */

function Hero({ cfg }: { cfg: PreviewConfig }) {
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: `linear-gradient(140deg, ${NAVY} 10%, #07426a 55%, #0e6f86)` }}>
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl" style={{ background: CORAL }} />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: TEAL }} />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="eyebrow" style={{ color: LIME }}>{cfg.businessName} × OneShetland</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-[0.98] [text-shadow:_0_2px_24px_rgb(0_0_0_/_30%)] sm:text-6xl lg:text-7xl">
            Your products.<br />Your story.<br /><span style={{ color: LIME }}>Discoverable across Shetland.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{cfg.hero.support}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#how-it-could-look" className="rounded-full px-6 py-3.5 text-sm font-bold shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60" style={{ background: LIME, color: NAVY }}>See how it could look ↓</a>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3.5 py-2 text-xs font-bold text-white/90"><Lock className="h-3.5 w-3.5" /> Nothing is published</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <Shopfront eager cfg={cfg} className="aspect-[4/5] w-full rounded-[2rem] shadow-2xl ring-4 ring-white/15" />
          <div className="absolute -bottom-5 -left-3 w-40 rotate-[-4deg] overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl sm:-left-8 sm:w-48">
            <Img eager src={cfg.products[0].image} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-bold text-[#032f4c]">{cfg.products[0].title}</p>
          </div>
          <div className="absolute -right-2 top-4 rotate-[5deg] sm:-right-5"><PreviewTag>Example preview</PreviewTag></div>
        </div>
      </div>
    </section>
  );
}

/* ── private notice (not small print) ─────────────────────────────────── */

function PrivateNotice({ cfg }: { cfg: PreviewConfig }) {
  const facts = [
    ["This is a private preview.", "Only people with this invitation can see it."],
    ["Nothing is live.", "No product, offer or reward exists on OneShetland."],
    [`${cfg.businessName} has not joined OneShetland.`, "This page does not mean otherwise."],
    ["Nothing is published without your approval.", "You choose, and you press Go live."],
  ];
  return (
    <section className="relative bg-white" aria-labelledby="private-h">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="rounded-[2rem] border-2 p-6 sm:p-9" style={{ borderColor: NAVY }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full text-white" style={{ background: NAVY }}><Lock className="h-5 w-5" /></span>
            <h2 id="private-h" className="font-display text-2xl font-bold sm:text-4xl">Your private OneShetland preview</h2>
          </div>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-snug text-ink sm:text-xl">
            We&apos;ve put together an example of how {cfg.businessName} could look on OneShetland. Nothing on this page is live or visible to the public. Only people with this private invitation can see it.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([a, b]) => (
              <li key={a} className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="font-display text-lg font-bold leading-tight" style={{ color: NAVY }}>{a}</p>
                <p className="mt-1 text-sm text-ink-soft">{b}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-sm text-ink-soft">
            We&apos;ve used publicly available information simply to show what is possible. Nothing will be published until you claim the business and explicitly approve it.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── 3. business profile ──────────────────────────────────────────────── */

function Profile({ cfg, facts }: { cfg: PreviewConfig; facts: DirectoryFacts }) {
  const description = shorten(facts.description ?? cfg.business.description, 330);
  const locality = facts.locality ?? cfg.business.locality;
  return (
    <Section id="how-it-could-look" eyebrow="How your business could appear" title={<>{cfg.businessName}, <span style={{ color: CORAL }}>as locals and visitors would meet you.</span></>}>
      <div className="grid overflow-hidden rounded-[2rem] bg-white shadow-xl lg:grid-cols-[.8fr_1.2fr]">
        <Shopfront cfg={cfg} className="min-h-[300px] lg:min-h-[420px]" />
        <div className="p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "#7c3aed" }}>{cfg.business.categoryLabel}</span>
            <PreviewTag>Preview</PreviewTag>
          </div>
          <h3 className="mt-4 font-display text-4xl font-bold sm:text-5xl">{facts.name}</h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {locality}
          </p>
          <p className="mt-5 max-w-prose leading-relaxed text-ink-soft">{description}</p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Ways people could find you">
            {cfg.business.tags.map((t) => <li key={t} className="rounded-full border border-line bg-[#fbf8f2] px-3.5 py-1.5 text-sm font-semibold text-ink-soft">{t}</li>)}
          </ul>
          <p className="mt-7 border-t border-line pt-4 text-xs text-ink-muted">
            This is based on the OneShetland Directory listing that already exists for {cfg.businessName}. We have not changed it.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ── 4. products in the shop ──────────────────────────────────────────── */

function ProductCard({ p, big = false }: { p: PreviewProduct; big?: boolean }) {
  return (
    <article className={"group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft " + (big ? "sm:col-span-2 lg:row-span-2" : "")}>
      <div className={"relative overflow-hidden bg-[#f3ece0] " + (big ? "aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1" : "aspect-square")}>
        <Img src={p.image} alt={p.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3"><PreviewTag>Preview</PreviewTag></div>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className={"font-display font-bold leading-tight " + (big ? "text-2xl sm:text-3xl" : "text-lg")}>{p.title}</h3>
        <p className="mt-1 text-sm text-ink-soft">{p.blurb}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="font-display text-xl font-bold" style={{ color: NAVY }}>{gbp(p.price)}</p>
          <span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-bold text-ink-muted">Preview · not for sale</span>
        </div>
      </div>
    </article>
  );
}

function Products({ cfg }: { cfg: PreviewConfig }) {
  const [first, ...rest] = cfg.products;
  return (
    <Section eyebrow="Shop Shetland" tone="sand" title={<>Your products, <span style={{ color: CORAL }}>in the Shop.</span></>}>
      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft" style={{ color: NAVY }}>
        <Lock className="h-4 w-4" /> Preview products — not live
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <ProductCard p={first} big />
        {rest.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
      <p className="mt-6 max-w-3xl text-sm text-ink-soft">
        A small, representative selection, using the names, photographs and prices already shown on{" "}
        <a href={cfg.sourceSite.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{cfg.sourceSite.label}</a>.
        Stock and prices are not live or synced, and there is no checkout — nothing here can be bought.
      </p>
    </Section>
  );
}

/* ── 5. across OneShetland ────────────────────────────────────────────── */

function Frame({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-soft">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line bg-[#fbf8f2] px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</span>
        <PreviewTag>Illustration · not live</PreviewTag>
      </figcaption>
      <div className="flex-1 p-4 sm:p-5">
        <p className="mb-3 font-display text-xl font-bold">{title}</p>
        {children}
      </div>
    </figure>
  );
}

const Skeleton = ({ className = "" }: { className?: string }) => <span aria-hidden="true" className={`block rounded-2xl bg-[#efe8da] ${className}`} />;

function Across({ cfg, facts }: { cfg: PreviewConfig; facts: DirectoryFacts }) {
  const p = cfg.products;
  return (
    <Section eyebrow="Seen across OneShetland" title={<>Where people would <span style={{ color: CORAL }}>find you.</span></>}>
      <p className="-mt-3 mb-8 max-w-2xl text-ink-soft">
        Not a promise about reach — a look at the places {cfg.businessName} could appear. The neighbouring cards are blank on purpose: they stand in for other Shetland businesses.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Frame label="Home" title="Discover local">
          <div className="-mx-1 flex gap-3 overflow-hidden px-1">
            <Skeleton className="h-36 w-28 shrink-0" />
            <div className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl text-white shadow-lg ring-2" style={{ boxShadow: `0 0 0 2px ${CORAL}` }}>
              <Shopfront cfg={cfg} className="absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/90 via-transparent to-transparent" />
              <p className="absolute bottom-2 left-3 right-3 text-sm font-bold leading-tight">{facts.name}<span className="block text-[11px] font-semibold text-white/80">{cfg.business.categoryLabel.split(" · ")[0]} · Lerwick</span></p>
            </div>
            <Skeleton className="h-36 w-28 shrink-0" />
          </div>
        </Frame>
        <Frame label="Local" title="Featured locally">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-h-[150px] flex-col justify-between rounded-3xl p-4 text-white shadow-soft" style={{ background: "linear-gradient(150deg,#7c3aed,#7c3aedb0 65%,#1e1b4b)" }}>
              <span className="w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">Shop</span>
              <div><p className="font-display text-lg font-bold leading-tight">{facts.name}</p><p className="text-xs text-white/80">{cfg.business.locality}</p></div>
            </div>
            <Skeleton className="min-h-[150px]" />
          </div>
        </Frame>
        <Frame label="Shop" title="In the Shop">
          <div className="grid grid-cols-3 gap-2.5">
            {[p[0], p[1]].map((x) => (
              <div key={x.id} className="overflow-hidden rounded-2xl border border-line">
                <Img src={x.image} alt={x.title} className="aspect-square w-full object-cover" />
                <p className="truncate px-2 pt-1.5 text-[11px] font-bold">{x.title}</p>
                <p className="px-2 pb-2 text-[11px] text-ink-soft">{gbp(x.price)} · {facts.name}</p>
              </div>
            ))}
            <Skeleton className="aspect-[3/4]" />
          </div>
        </Frame>
        <Frame label="Search" title={`Someone searches for “${cfg.searchTerm}”`}>
          <div className="flex items-center gap-2 rounded-full border border-line bg-[#fbf8f2] px-4 py-2.5 text-sm text-ink-soft">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
            {cfg.searchTerm}
          </div>
          <ul className="mt-3 space-y-2.5">
            <li className="flex items-center gap-3 rounded-2xl p-2 ring-2" style={{ boxShadow: `0 0 0 2px ${CORAL}` }}>
              <Shopfront cfg={cfg} className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0"><p className="truncate text-sm font-bold">{facts.name}</p><p className="truncate text-xs text-ink-soft">{cfg.business.categoryLabel} · {cfg.business.locality}</p></div>
            </li>
            <li><Skeleton className="h-14" /></li>
          </ul>
        </Frame>
      </div>
    </Section>
  );
}

/* ── 6. more than products ────────────────────────────────────────────── */

function More({ cfg }: { cfg: PreviewConfig }) {
  return (
    <Section eyebrow="More than products" tone="sand" title={<>Things {cfg.businessName} <span style={{ color: CORAL }}>could do — if you want to.</span></>}>
      <p className="-mt-3 mb-8 max-w-2xl text-ink-soft">None of this is switched on, and nothing has been created for you. These are possibilities, shown as examples.</p>
      <div className="grid gap-5 md:grid-cols-3">
        <article className="flex flex-col rounded-[1.75rem] p-6 text-white shadow-soft" style={{ background: "linear-gradient(150deg,#d97706,#92400e)" }}>
          <PreviewTag dark>Example only</PreviewTag>
          <h3 className="mt-4 font-display text-3xl font-bold">Offers</h3>
          <p className="mt-2 text-white/90">Run an occasional offer for local customers — when you want one, for as long as you choose.</p>
          <div className="mt-5 rounded-2xl border-2 border-dashed border-white/50 p-4 text-sm text-white/90">Your offer, in your words, would appear here. We haven&apos;t written one for you.</div>
        </article>
        <article className="flex flex-col rounded-[1.75rem] p-6 text-white shadow-soft" style={{ background: "linear-gradient(150deg,#6d28d9,#312e81)" }}>
          <PreviewTag dark>Example only</PreviewTag>
          <h3 className="mt-4 font-display text-3xl font-bold">Rewards</h3>
          <p className="mt-2 text-white/90">Reward repeat local customers with stamps or points — the reward is entirely yours to choose.</p>
          <div className="mt-5 grid grid-cols-5 gap-2" aria-label="An example stamp card, with no reward set">
            {Array.from({ length: 10 }).map((_, i) => <span key={i} className="grid aspect-square place-items-center rounded-full border-2 border-dashed border-white/50 text-xs font-bold text-white/70">{i + 1}</span>)}
          </div>
        </article>
        <article className="flex flex-col rounded-[1.75rem] p-6 text-white shadow-soft" style={{ background: "linear-gradient(150deg,#0e7490,#164e63)" }}>
          <PreviewTag dark>Possibility</PreviewTag>
          <h3 className="mt-4 font-display text-3xl font-bold">Local discovery</h3>
          <p className="mt-2 text-white/90">Appear when people browse what&apos;s nearby or what&apos;s good locally — on the Local pages and in search.</p>
          <p className="mt-5 text-sm text-white/80">Locals and visitors both use OneShetland to see what Shetland&apos;s own businesses have to offer.</p>
        </article>
      </div>
    </Section>
  );
}

/* ── 7. catalogue setup ───────────────────────────────────────────────── */

function Catalogue() {
  const options = [
    { title: "Import products", body: "Upload an existing catalogue or CSV, check it, and bring it in as drafts.", chip: "Being prepared", tone: LIME, text: NAVY },
    { title: "Add manually", body: "Add individual products yourself, with photos, one at a time.", chip: "Available", tone: "#d1fae5", text: "#065f46" },
    { title: "Connect your shop", body: "Shopify · WooCommerce · Square", chip: "Coming next", tone: "#ffe4de", text: "#9a3412" },
  ];
  return (
    <Section eyebrow="Easy catalogue setup" title={<>Already selling online? <span style={{ color: CORAL }}>You won&apos;t rebuild it from scratch.</span></>}>
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((o) => (
          <article key={o.title} className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft">
            <span className="inline-block rounded-full px-3 py-1 text-xs font-bold" style={{ background: o.tone, color: o.text }}>{o.chip}</span>
            <h3 className="mt-4 font-display text-2xl font-bold">{o.title}</h3>
            <p className="mt-1.5 text-ink-soft">{o.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-5 max-w-2xl text-sm text-ink-soft">
        Everything you bring in arrives as a draft that only you can see. You review it, and you decide what to publish. Connecting a shop is still being built — we&apos;ll only tell you it works once it does.
      </p>
    </Section>
  );
}

/* ── 8. launch partner offer ──────────────────────────────────────────── */

function PartnerOffer({ cfg }: { cfg: PreviewConfig }) {
  const points = [
    "Complimentary launch-partner Premium access",
    "Darren personally helps you get set up",
    "Your existing business listing can be claimed",
    "Your products can appear across OneShetland",
    "No obligation",
    "Nothing goes live until you approve it",
  ];
  return (
    <Section tone="navy" eyebrow="Launch partners" title={<>Be one of OneShetland&apos;s first <span style={{ color: LIME }}>launch partners.</span></>}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <p className="max-w-lg text-lg leading-relaxed text-white/90">
          OneShetland is the home for Shetland&apos;s own businesses, and we&apos;re opening with a small group of launch partners. We&apos;d love {cfg.businessName} to be one of them — on your terms, at your pace.
        </p>
        <ul className="grid gap-2.5">
          {points.map((t) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-black" style={{ background: LIME, color: NAVY }} aria-hidden="true">✓</span>
              <span className="font-semibold">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ── 9. what happens next ─────────────────────────────────────────────── */

function Steps() {
  const steps = [
    ["Claim your private preview", "A first, safe step."],
    ["Confirm your business", "So we know it's really you."],
    ["Review what we've prepared", "Change anything, or throw it away."],
    ["Add or import your real catalogue", "Your products, your photos."],
    ["Choose what you want to publish", "Only what you pick."],
    ["You press Go live", "Not us. Not before you're ready."],
  ];
  return (
    <Section eyebrow="What happens next" title={<>Six steps, <span style={{ color: CORAL }}>and you&apos;re in control of every one.</span></>}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([t, s], i) => (
          <li key={t} className="flex gap-4 rounded-[1.5rem] border border-line bg-white p-5 shadow-soft">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-bold text-white" style={{ background: i === 5 ? CORAL : NAVY }}>{i + 1}</span>
            <div><p className="font-display text-xl font-bold leading-tight">{t}</p><p className="mt-0.5 text-sm text-ink-soft">{s}</p></div>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-2xl border-2 px-5 py-4 font-display text-xl font-bold sm:text-2xl" style={{ borderColor: NAVY, color: NAVY }}>
        Claiming your preview does NOT publish anything.
      </p>
    </Section>
  );
}

/* ── 10. closing CTA + trust note ─────────────────────────────────────── */

function Closing({ cfg }: { cfg: PreviewConfig }) {
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: `linear-gradient(140deg, ${NAVY}, #0a4a70 60%, #0e6f86)` }}>
      <div className="pointer-events-none absolute -left-20 top-0 -z-10 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: CORAL }} />
      <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-24">
        <h2 className="font-display text-4xl font-bold sm:text-6xl">Like what you see?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">There&apos;s no rush and no obligation. Nothing is published, and nothing will be unless you say so.</p>
        <div className="mt-8 flex justify-center"><ClaimCta businessName={cfg.businessName} /></div>
      </div>
    </section>
  );
}

function Trust({ name }: { name: string }) {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-4xl px-5 py-10 text-center">
        <p className="mx-auto flex max-w-2xl items-start justify-center gap-2 text-sm leading-relaxed text-ink-soft">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This preview was prepared privately by OneShetland using information already publicly available from {name}. It is not a public listing and does not indicate participation or endorsement.</span>
        </p>
      </div>
    </footer>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

export function PreviewPage({ cfg, facts }: { cfg: PreviewConfig; facts: DirectoryFacts }) {
  return (
    <div className="overflow-x-clip">
      <PrivateBar name={cfg.businessName} />
      <Hero cfg={cfg} />
      <PrivateNotice cfg={cfg} />
      <Profile cfg={cfg} facts={facts} />
      <Products cfg={cfg} />
      <Across cfg={cfg} facts={facts} />
      <More cfg={cfg} />
      <Catalogue />
      <PartnerOffer cfg={cfg} />
      <Steps />
      <Closing cfg={cfg} />
      <Trust name={cfg.businessName} />
    </div>
  );
}
