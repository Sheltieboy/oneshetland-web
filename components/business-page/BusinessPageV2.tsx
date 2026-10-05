import type { ReactNode } from "react";
import Link from "next/link";
import { BusinessLocationMap } from "@/components/local/BusinessLocationMap";
import { Img, MediaCard, ProductTile, ReserveCard, Section } from "@/components/design-v2/primitives";
import { DAYS, formatDay, hoursExpired, isOpenAt } from "@/lib/opening-hours";
import { planSections } from "@/lib/business-page/sections";
import { CORAL, NAVY, gbp } from "@/lib/business-page/tokens";
import type { BusinessPageModel, ModelItem, SectionId } from "@/lib/business-page/types";

/** Server clock, read at request time (kept out of the component body so rendering stays a pure function of the model). */
const nowDate = () => new Date();

/**
 * Business Page V2 — the customer-facing business page in the V2 design language (Fraunces display type, editorial
 * photography, varied card proportions). It renders a BusinessPageModel; WHICH sections appear, and in what order,
 * is decided by planSections() from what the business really has.
 *
 * In draft mode it is private (admin, or the approved owner) and every example item is labelled as such.
 * It is NOT wired to the public route in this version.
 */
export function BusinessPageV2({ model, draftNote }: { model: BusinessPageModel; draftNote?: string }) {
  const order = planSections(model);
  return (
    <div className="bg-[#fbf8f2] text-ink">
      {model.mode === "draft" && <DraftBar note={draftNote} />}
      <Hero model={model} />
      {order.map((id) => <SectionFor key={id} id={id} model={model} accent={model.identity.accent} />)}
    </div>
  );
}

/* ── draft banner ─────────────────────────────────────────────────────── */

function DraftBar({ note }: { note?: string }) {
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 text-white" style={{ background: NAVY }} role="note" aria-label="This is a private draft. It is not public.">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs">{note ?? "Private draft · Not public"}</p>
      </div>
    </div>
  );
}

const ExampleTag = ({ children = "Example" }: { children?: ReactNode }) => <span className="inline-flex items-center rounded-full bg-[#032f4c]/90 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">{children}</span>;

/* ── hero / identity ──────────────────────────────────────────────────── */

function Hero({ model }: { model: BusinessPageModel }) {
  const { identity: id, hero } = model;
  const a = id.accent;
  const open = isOpenAt(model.hours.hours, nowDate(), model.hours.until);
  return (
    <section className="relative isolate flex min-h-[62vh] flex-col justify-end overflow-hidden text-white sm:min-h-[70vh]" style={{ background: `linear-gradient(140deg, ${a}, ${NAVY})` }}>
      {hero.image && <Img eager src={hero.image.src} alt={hero.image.alt} className="absolute inset-0 -z-20 h-full w-full object-cover" style={{ objectPosition: hero.image.position }} />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-24 sm:pb-20">
        <div className="flex flex-wrap items-center gap-2">
          {id.categoryLabel && <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: a }}>{id.categoryLabel}</span>}
          {id.verified && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm"><span aria-hidden>✓</span> Verified</span>}
          {open !== null && <span className={"rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm " + (open ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20")}>{open ? "Open now" : "Closed now"}</span>}
        </div>
        <div className="mt-4 flex items-end gap-4">
          {id.logo && <span className="hidden h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl sm:grid"><Img eager src={id.logo} alt="" className="h-full w-full object-contain" /></span>}
          <div className="min-w-0">
            <h1 className="font-display text-[2.8rem] font-bold leading-[0.98] [text-shadow:_0_2px_24px_rgb(0_0_0_/_35%)] sm:text-6xl lg:text-7xl">{hero.headline}</h1>
            {hero.tagline && <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{hero.tagline}</p>}
            {id.locality && <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-white/85"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>{id.locality}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── the sections ─────────────────────────────────────────────────────── */

function SectionFor({ id, model, accent }: { id: SectionId; model: BusinessPageModel; accent: string }) {
  switch (id) {
    case "actions": return <Actions model={model} accent={accent} />;
    case "story": return <Story model={model} accent={accent} />;
    case "shop": return <Shop model={model} accent={accent} />;
    case "offers": return <Offers model={model} accent={accent} />;
    case "book": return <Book model={model} />;
    case "experience": return <Experience model={model} />;
    case "rewards": return <Rewards model={model} accent={accent} />;
    case "events": return <Events model={model} accent={accent} />;
    case "useful": return <Useful model={model} />;
    case "hours": return <Hours model={model} accent={accent} />;
    case "location": return <Location model={model} accent={accent} />;
    case "contact": return <Contact model={model} accent={accent} />;
  }
}

/** Primary actions: only the ones this business can really offer. They overlap the hero's lower edge. */
function Actions({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const btns: { href: string; label: string; primary?: boolean; external?: boolean }[] = [];
  if (model.shop?.items.length) btns.push({ href: "#shop", label: "Shop", primary: true });
  if (model.book) btns.push({ href: "#book", label: model.book.cta, primary: !model.shop });
  if (model.location.mapHref) btns.push({ href: model.location.mapHref, label: "Directions", external: true });
  if (model.contact.phone) btns.push({ href: `tel:${model.contact.phone}`, label: "Call" });
  if (model.contact.website) btns.push({ href: model.contact.website, label: "Website", external: true });
  if (!btns.length) return null;
  return (
    <div className="relative z-10 -mt-7 px-5">
      <nav aria-label="Primary actions" className="mx-auto flex max-w-6xl flex-wrap gap-2 rounded-[1.75rem] bg-white p-3 shadow-xl ring-1 ring-black/5">
        {btns.map((b) => (
          <a key={b.label} href={b.href} {...(b.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={"rounded-full px-5 py-2.5 text-sm font-bold transition hover:brightness-105 " + (b.primary ? "text-white" : "border border-line text-ink-soft hover:bg-sand")} style={b.primary ? { background: accent } : undefined}>{b.label}</a>
        ))}
      </nav>
    </div>
  );
}

function Story({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const st = model.story;
  const body = st?.body ?? (model.about ? [model.about] : []);
  const title = st?.title ?? `About ${model.identity.name}`;
  return (
    <Section id="story" eyebrow={st?.eyebrow ?? "About"} title={title}>
      <div className="grid gap-6 rounded-[2rem] bg-white p-6 shadow-xl sm:p-10 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4 text-lg leading-relaxed text-ink-soft">{body.map((t, i) => <p key={i}>{t}</p>)}</div>
        <div className="flex flex-col justify-end rounded-3xl p-6 text-white" style={{ background: `linear-gradient(150deg, ${accent}, #1e1b4b)` }}>
          <p className="font-display text-2xl font-bold leading-snug">{model.identity.name}</p>
          <p className="mt-1 text-sm text-white/80">{[model.identity.categoryLabel, model.identity.locality].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {st?.source && <p className="mt-4 text-xs text-ink-muted">Based on <a href={st.source} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">the business&rsquo;s own website</a>.</p>}
    </Section>
  );
}

function Shop({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const shop = model.shop!;
  const big = shop.items.length >= 5;
  return (
    <Section id="shop" eyebrow="Shop Shetland" tone="sand" title={shop.title}>
      {shop.example && <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft" style={{ color: NAVY }}>Example products — replaced by your real catalogue</p>}
      <div className={"grid gap-4 sm:grid-cols-2 sm:gap-5 " + (big ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {shop.items.map((p: ModelItem, i) => (
          <ProductTile key={p.id} big={big && i === 0} title={p.title} price={p.pricePounds} image={p.image} blurb={p.blurb} accent={accent}
            href={p.example ? undefined : p.href}
            tag={p.example ? <ExampleTag /> : undefined}
            footer={p.example ? <span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-bold text-ink-muted">Example · not for sale</span> : undefined} />
        ))}
      </div>
    </Section>
  );
}

function Offers({ model, accent }: { model: BusinessPageModel; accent: string }) {
  return (
    <Section id="offers" eyebrow="Offers" title={<>Current <span style={{ color: CORAL }}>offers.</span></>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {model.offers.map((o) => (
          <article key={o.id} className="overflow-hidden rounded-3xl bg-white shadow-soft">
            {o.image && <Img src={o.image} alt="" className="aspect-[16/9] w-full object-cover" />}
            <div className="p-5"><h3 className="font-display text-xl font-bold" style={{ color: accent }}>{o.title}</h3>{o.description && <p className="mt-1 text-sm text-ink-soft">{o.description}</p>}</div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Book({ model }: { model: BusinessPageModel }) {
  const b = model.book!;
  return (
    <Section id="book" eyebrow="Book local" tone="sand" title={<>Book with <span style={{ color: CORAL }}>{model.identity.name}.</span></>}>
      {b.example ? (
        <div className="grid items-center gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <ReserveCard heading="Reserve" kind="Table" cta={b.cta} businessName={model.identity.name} tag={<ExampleTag>Example</ExampleTag>} buttonLabel="Book"
            status={<span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-bold text-ink-muted">Example · not live</span>} />
          <p className="text-lg leading-relaxed text-ink-soft">{b.line}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {b.services.map((s) => (
            <li key={s.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-soft">
              <h3 className="font-display text-xl font-bold">{s.name}</h3>
              {s.description && <p className="mt-1 text-sm text-ink-soft">{s.description}</p>}
              <p className="mt-2 text-sm text-ink-muted">{[s.durationMinutes ? `${s.durationMinutes} min` : null, s.pricePence != null ? gbp(s.pricePence / 100) : null].filter(Boolean).join(" · ")}</p>
              <Link href={`/directory/${model.identity.id}?book=${s.id}`} className="mt-4 self-start rounded-full px-5 py-2 text-sm font-bold text-white" style={{ background: model.identity.accent }}>Book</Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Experience({ model }: { model: BusinessPageModel }) {
  const x = model.experience!;
  return (
    <Section id="experience" eyebrow="Experiences" title={<>More than a shop — <span style={{ color: CORAL }}>come and see.</span></>}>
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <MediaCard image={x.image} title={x.title} subtitle={`${model.identity.name}${x.meta ? ` · ${x.meta}` : ""}`} price={x.price} tag={<ExampleTag>Example</ExampleTag>} />
        <div>
          <p className="text-lg leading-relaxed text-ink-soft">{x.blurb}</p>
          <p className="mt-4 text-xs text-ink-muted">Example, based on what <a href={x.source} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">the business&rsquo;s own website</a> already says. Not bookable here yet.</p>
        </div>
      </div>
    </Section>
  );
}

function Rewards({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const r = model.rewards!;
  return (
    <Section id="rewards" eyebrow="Rewards" tone="sand" title={<>Keep them <span style={{ color: CORAL }}>coming back.</span></>}>
      <div className="max-w-2xl overflow-hidden rounded-[2rem] p-7 text-white shadow-xl" style={{ background: `linear-gradient(150deg, ${accent}, #312e81)` }}>
        {r.example && <ExampleTag>An idea — not set up</ExampleTag>}
        <p className="mt-3 font-display text-3xl font-bold">{r.title}</p>
        <p className="mt-2 text-white/90">{r.body}</p>
      </div>
    </Section>
  );
}

function Events({ model, accent }: { model: BusinessPageModel; accent: string }) {
  return (
    <Section id="events" eyebrow="What's on" title="Upcoming events">
      <ul className="space-y-3">
        {model.events.map((e) => (
          <li key={e.id}>
            <Link href={`/whats-on/${e.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-soft transition hover:shadow-lift">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-center text-xs font-bold text-white" style={{ background: accent }}>
                {new Date(e.startsAt).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric" })}<br />{new Date(e.startsAt).toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "short" })}
              </span>
              <span className="min-w-0"><span className="block truncate font-display font-bold">{e.title}</span>{e.venue && <span className="text-sm text-ink-muted">{e.venue}</span>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Useful({ model }: { model: BusinessPageModel }) {
  return (
    <Section id="useful" eyebrow="Good to know" tone="sand" title="Useful local information">
      <div className="grid gap-4 md:grid-cols-2">
        {model.useful.map((u) => (
          <article key={u.title} className="rounded-3xl bg-white p-6 shadow-soft"><h3 className="font-display text-xl font-bold">{u.title}</h3><div className="mt-2 space-y-2 text-ink-soft">{u.body.map((t, i) => <p key={i}>{t}</p>)}</div></article>
        ))}
      </div>
    </Section>
  );
}

function Hours({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const h = model.hours.hours!;
  const stale = hoursExpired(model.hours.until, nowDate());
  return (
    <Section id="hours" eyebrow="Opening" title="Opening hours">
      {stale && <p className="mb-4 max-w-xl rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">These were seasonal hours that have now ended. Check before you go.</p>}
      <dl className="grid max-w-xl gap-1.5 rounded-3xl bg-white p-6 text-sm shadow-soft">
        {DAYS.map((d) => <div key={d.key} className="flex justify-between gap-3"><dt className="text-ink-muted">{d.label}</dt><dd className="font-semibold" style={{ color: h[d.key] ? accent : undefined }}>{formatDay(h[d.key])}</dd></div>)}
      </dl>
    </Section>
  );
}

function Location({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const l = model.location;
  return (
    <Section id="location" eyebrow="Find us" tone="sand" title="Where to find us">
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          {l.address && <p className="font-display text-xl font-bold">{l.address}</p>}
          {l.mapHref && <a href={l.mapHref} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: accent }}>Directions →</a>}
        </div>
        {l.lat != null && l.lng != null && <div className="overflow-hidden rounded-3xl bg-white shadow-soft"><BusinessLocationMap lat={l.lat} lng={l.lng} name={model.identity.name} accent={accent} height={280} /></div>}
      </div>
    </Section>
  );
}

function Contact({ model, accent }: { model: BusinessPageModel; accent: string }) {
  const c = model.contact;
  const rows: [string, string, string][] = [];
  if (c.phone) rows.push(["Phone", c.phone, `tel:${c.phone}`]);
  if (c.website) rows.push(["Website", c.website.replace(/^https?:\/\//, ""), c.website]);
  if (c.email) rows.push(["Email", c.email, `mailto:${c.email}`]);
  return (
    <Section id="contact" eyebrow="Get in touch" title="Contact">
      <dl className="grid max-w-xl gap-4 rounded-3xl bg-white p-6 shadow-soft">
        {rows.map(([k, v, href]) => <div key={k}><dt className="eyebrow text-ink-muted">{k}</dt><dd className="mt-0.5"><a href={href} className="break-all font-semibold hover:underline" style={{ color: accent }} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{v}</a></dd></div>)}
      </dl>
    </Section>
  );
}
