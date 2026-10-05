import type { ReactNode } from "react";
import Link from "next/link";
import { LocationPanel } from "./LocationPanel";
import type { BusinessPageSlots } from "./slots";
import { Img, MediaCard, ProductTile, ReserveCard, Section } from "@/components/design-v2/primitives";
import { DAYS, formatDay, hoursExpired, isOpenAt } from "@/lib/opening-hours";
import { enforceLive, heroActions, planSections, type HeroAction } from "@/lib/business-page/sections";
import { PREPARED_COPY } from "@/lib/business-page/prepared-copy";
import { CORAL, LIME, NAVY, gbp } from "@/lib/business-page/tokens";
import type { BusinessPageModel, ModelItem, SectionId } from "@/lib/business-page/types";

/** Server clock, read at request time (kept out of the component body so rendering stays a pure function of the model). */
const nowDate = () => new Date();

/**
 * Business Page V2 — the customer-facing business page in the V2 design language (Fraunces display type, editorial
 * photography, varied card proportions). It renders a BusinessPageModel; WHICH sections appear, and in what order,
 * is decided by planSections() from what the business really has, and the hero's actions by heroActions().
 *
 * Two modes, one component set:
 *   prepared — private (admin, or the approved owner). Shows clearly-marked examples and suggestions.
 *   live     — customer-facing. enforceLive() removes every example before anything renders; only genuine
 *              published content appears, and a section with nothing genuine is omitted.
 * It is NOT wired to the public route in this version. Real interactive actions plug in through `slots`.
 */
export function BusinessPageV2({ model: given, slots = {}, draftNote }: { model: BusinessPageModel; slots?: BusinessPageSlots; draftNote?: string }) {
  const model = enforceLive(given);
  const order = planSections(model);
  const actions = heroActions(model);
  const prepared = model.mode === "prepared";
  return (
    <div className="bg-[#fbf8f2] text-ink">
      {prepared && <DraftBar note={draftNote} />}
      {prepared && <p className="border-b border-line bg-[#f3ece0] px-5 py-3 text-center text-sm text-ink-soft">{PREPARED_COPY.intro}</p>}
      <Hero model={model} actions={actions} slots={slots} />
      {order.map((id) => <SectionFor key={id} id={id} model={model} accent={model.identity.accent} slots={slots} />)}
    </div>
  );
}

/* ── prepared-mode furniture ──────────────────────────────────────────── */

function DraftBar({ note }: { note?: string }) {
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 text-white" style={{ background: NAVY }} role="note" aria-label="This is a private draft. It is not public.">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs">{note ?? PREPARED_COPY.bar}</p>
      </div>
    </div>
  );
}

/** A small marker for prepared-only items. Only ever rendered when the model says an item is not genuine. */
const PreparedTag = ({ children = PREPARED_COPY.tag }: { children?: ReactNode }) => <span className="inline-flex items-center rounded-full bg-[#032f4c]/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{children}</span>;

/* ── hero ─────────────────────────────────────────────────────────────── */

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

function Hero({ model, actions, slots }: { model: BusinessPageModel; actions: HeroAction[]; slots: BusinessPageSlots }) {
  const { identity: id, hero } = model;
  const open = isOpenAt(model.hours.hours, nowDate(), model.hours.until);
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: `linear-gradient(140deg, ${id.accent} 0%, ${NAVY} 80%)` }}>
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl" style={{ background: CORAL }} />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: "#12b3d6" }} />
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-14 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-20 lg:pt-16">
        <div className="order-last min-w-0 lg:order-first">
          <div className="flex flex-wrap items-center gap-2">
            {id.categoryLabel && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm">{id.categoryLabel}</span>}
            {id.verified && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm"><span aria-hidden>✓</span> Verified</span>}
            {open !== null && <span className={"rounded-full px-3 py-1 text-xs font-bold " + (open ? "bg-emerald-400 text-emerald-950" : "bg-white/15 backdrop-blur-sm")}>{open ? "Open now" : "Closed now"}</span>}
          </div>
          <h1 className="mt-4 break-words font-display text-[2.6rem] font-bold leading-[0.98] [text-shadow:_0_2px_24px_rgb(0_0_0_/_30%)] sm:text-6xl lg:text-7xl">{hero.headline}</h1>
          {hero.tagline && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{hero.tagline}</p>}
          {id.locality && <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-white/85"><svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>{id.locality}</p>}
          {(actions.length > 0 || slots.follow) && (
            <nav aria-label="Primary actions" className="mt-7 flex flex-wrap items-center gap-2.5">
              {actions.map((a, i) => (
                <a key={a.id} href={a.href} {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={"rounded-full px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 " + (i === 0 ? "shadow-lg hover:brightness-105" : "border border-white/40 text-white hover:bg-white/10")}
                  style={i === 0 ? { background: LIME, color: NAVY } : undefined}>{a.label}{a.external && a.id === "directions" ? " →" : ""}</a>
              ))}
              {slots.follow?.({ businessId: id.id, accent: id.accent })}
            </nav>
          )}
        </div>
        <div className="relative order-first mx-auto w-full max-w-md lg:order-last lg:max-w-none"><HeroVisual model={model} /></div>
      </div>
    </section>
  );
}

function HeroVisual({ model }: { model: BusinessPageModel }) {
  const { hero, identity: id } = model;
  const frame = "relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] shadow-2xl ring-4 ring-white/15 lg:aspect-[4/5]";
  if (hero.visual === "photo" && hero.image) {
    const [a, b] = hero.collage;
    return (
      <>
        <div className={frame}><Img eager src={hero.image.src} alt={hero.image.alt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: hero.image.position }} /></div>
        {a && hero.collage.length >= 2 && (
          <div className="absolute -bottom-4 -left-2 hidden w-36 rotate-[-4deg] overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl sm:block lg:-left-8 lg:w-44">
            <Img eager src={a.src} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-bold text-[#032f4c]">{a.alt}</p>
          </div>
        )}
        {b && hero.collage.length >= 2 && b.price != null && (
          <div className="absolute -right-2 bottom-10 hidden w-32 rotate-[4deg] overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl sm:block lg:-right-6 lg:w-40">
            <Img eager src={b.src} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-bold text-[#032f4c]">{gbp(b.price)}</p>
          </div>
        )}
      </>
    );
  }
  if (hero.visual === "mosaic" && hero.collage.length >= 3) {
    const [a, b, c] = hero.collage;
    const tile = (t: typeof a, cls: string, rot: string) => (
      <div className={`relative overflow-hidden rounded-3xl bg-white p-1.5 shadow-xl ${rot} ${cls}`}>
        <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">
          <Img eager src={t.src} alt={t.alt} className="absolute inset-0 h-full w-full object-cover" />
          {t.price != null && <span className="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-black text-ink shadow">{gbp(t.price)}</span>}
        </div>
      </div>
    );
    return (
      <div className="relative grid aspect-[5/4] w-full grid-cols-5 grid-rows-2 gap-3 lg:aspect-[4/5]">
        {tile(a, "col-span-3 row-span-2", "rotate-[-1.5deg]")}
        {tile(b, "col-span-2", "rotate-[2deg]")}
        {tile(c, "col-span-2", "rotate-[-1deg]")}
      </div>
    );
  }
  // The deliberate branded card: used whenever there is no suitable photograph.
  return (
    <div className={frame + " isolate grid place-items-center"} style={{ background: `linear-gradient(160deg, ${id.accent}, #1e1b4b)` }}>
      {hero.image && <Img eager src={hero.image.src} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25 mix-blend-luminosity" style={{ objectPosition: hero.image.position }} />}
      <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute inset-0 -z-10 h-full w-full opacity-25" fill="none" stroke="white" strokeWidth="1.5" preserveAspectRatio="xMidYMid slice"><circle cx="330" cy="70" r="60" /><circle cx="330" cy="70" r="105" /><circle cx="330" cy="70" r="150" /><circle cx="60" cy="340" r="50" /><circle cx="60" cy="340" r="95" /></svg>
      <div className="mx-6 w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl">
        <span className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-2xl text-3xl font-black text-white" style={{ background: id.logo ? "#fff" : id.accent }}>
          {id.logo ? <Img eager src={id.logo} alt="" className={"h-full w-full " + (/\.jpe?g(\?|$)/i.test(id.logo) ? "object-cover" : "object-contain p-1")} /> : initials(id.name)}
        </span>
        <p className="mt-4 font-display text-2xl font-bold leading-tight text-ink">{id.name}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: id.accent }}>{[id.categoryLabel, id.locality].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

/* ── the sections ─────────────────────────────────────────────────────── */

function SectionFor({ id, model, accent, slots }: { id: SectionId; model: BusinessPageModel; accent: string; slots: BusinessPageSlots }) {
  switch (id) {
    case "story": return <Story model={model} accent={accent} />;
    case "shop": return <Shop model={model} accent={accent} slots={slots} />;
    case "offers": return <Offers model={model} accent={accent} slots={slots} />;
    case "book": return <Book model={model} slots={slots} />;
    case "experience": return <Experience model={model} accent={accent} slots={slots} />;
    case "rewards": return <Rewards model={model} accent={accent} slots={slots} />;
    case "events": return <Events model={model} accent={accent} />;
    case "useful": return <Useful model={model} />;
    case "hours": return <Hours model={model} accent={accent} />;
    case "location": return <Location model={model} accent={accent} />;
    case "contact": return <Contact model={model} accent={accent} />;
  }
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

function Shop({ model, accent, slots }: { model: BusinessPageModel; accent: string; slots: BusinessPageSlots }) {
  const shop = model.shop!;
  const big = shop.items.length >= 5;
  return (
    <Section id="shop" eyebrow="Shop Shetland" tone="sand" title={shop.title}>
      <div className={"grid gap-4 sm:grid-cols-2 sm:gap-5 " + (big ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {shop.items.map((p: ModelItem, i) => (
          <ProductTile key={p.id} big={big && i === 0} title={p.title} price={p.pricePounds} image={p.image} blurb={p.blurb} accent={accent}
            href={p.example ? undefined : p.href}
            tag={p.example ? <PreparedTag /> : undefined}
            footer={p.example ? <span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-[11px] font-bold text-ink-muted">{PREPARED_COPY.notForSale}</span> : slots.productAction?.(p)} />
        ))}
      </div>
    </Section>
  );
}

function Offers({ model, accent, slots }: { model: BusinessPageModel; accent: string; slots: BusinessPageSlots }) {
  return (
    <Section id="offers" eyebrow="Offers" title={<>Current <span style={{ color: CORAL }}>offers.</span></>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {model.offers.map((o) => (
          <article key={o.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft">
            {o.image && <Img src={o.image} alt="" className="aspect-[16/9] w-full object-cover" />}
            <div className="flex flex-1 flex-col p-5"><h3 className="font-display text-xl font-bold" style={{ color: accent }}>{o.title}</h3>{o.description && <p className="mt-1 text-sm text-ink-soft">{o.description}</p>}{slots.offerAction && <div className="mt-4">{slots.offerAction(o, model.identity.id)}</div>}</div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Book({ model, slots }: { model: BusinessPageModel; slots: BusinessPageSlots }) {
  const b = model.book!;
  return (
    <Section id="book" eyebrow="Book local" tone="sand" title={<>Book with <span style={{ color: CORAL }}>{model.identity.name}.</span></>}>
      {b.example ? (
        <div className="grid items-center gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <ReserveCard heading="Reserve" kind="Table" cta={b.cta} businessName={model.identity.name} tag={<PreparedTag />} buttonLabel="Book"
            status={<span className="rounded-full border border-dashed border-line-strong px-3 py-1 text-[11px] font-bold text-ink-muted">{PREPARED_COPY.tag}</span>} />
          <div><p className="text-lg leading-relaxed text-ink-soft">{b.line}</p><p className="mt-3 text-xs text-ink-muted">{PREPARED_COPY.bookingNote}</p></div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {b.services.map((s) => (
            <li key={s.id} className="flex flex-col rounded-3xl bg-white p-5 shadow-soft">
              <h3 className="font-display text-xl font-bold">{s.name}</h3>
              {s.description && <p className="mt-1 text-sm text-ink-soft">{s.description}</p>}
              <p className="mt-2 text-sm text-ink-muted">{[s.durationMinutes ? `${s.durationMinutes} min` : null, s.pricePence != null ? gbp(s.pricePence / 100) : null].filter(Boolean).join(" · ")}</p>
              {slots.bookAction ? <div className="mt-4">{slots.bookAction(s, model.identity.id)}</div>
                : <Link href={`/directory/${model.identity.id}?book=${s.id}`} className="mt-4 self-start rounded-full px-5 py-2 text-sm font-bold text-white" style={{ background: model.identity.accent }}>Book</Link>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Experience({ model, accent, slots }: { model: BusinessPageModel; accent: string; slots: BusinessPageSlots }) {
  const x = model.experience;
  return (
    <Section id="experience" eyebrow="Experiences" title={model.passes.length && !x ? <>Experiences <span style={{ color: CORAL }}>&amp; passes.</span></> : <>More than a shop — <span style={{ color: CORAL }}>come and see.</span></>}>
      {model.passes.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {model.passes.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft">
              {p.image ? <Img src={p.image} alt="" className="aspect-[16/10] w-full object-cover" /> : <div className="aspect-[16/10] w-full" style={{ background: `linear-gradient(150deg, ${accent}, #1e1b4b)` }} />}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                {p.description && <p className="mt-1 text-sm text-ink-soft">{p.description}</p>}
                {p.pricePence != null && <p className="mt-2 font-display text-lg font-bold" style={{ color: accent }}>{gbp(p.pricePence / 100)}</p>}
                {slots.passAction && <div className="mt-4">{slots.passAction(p, model.identity.id)}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {x && (
        <div className={"grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr] " + (model.passes.length ? "mt-10" : "")}>
          <MediaCard image={x.image} title={x.title} subtitle={`${model.identity.name}${x.meta ? ` · ${x.meta}` : ""}`} price={x.price} tag={<PreparedTag />} />
          <div>
            <p className="text-lg leading-relaxed text-ink-soft">{x.blurb}</p>
            <p className="mt-4 text-xs text-ink-muted">{PREPARED_COPY.experienceNote} <a href={x.source} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">Source</a></p>
          </div>
        </div>
      )}
    </Section>
  );
}

function Rewards({ model, accent, slots }: { model: BusinessPageModel; accent: string; slots: BusinessPageSlots }) {
  const r = model.rewards!;
  return (
    <Section id="rewards" eyebrow="Rewards" tone="sand" title={<>Keep them <span style={{ color: CORAL }}>coming back.</span></>}>
      <div className="max-w-2xl overflow-hidden rounded-[2rem] p-7 text-white shadow-xl" style={{ background: `linear-gradient(150deg, ${accent}, #312e81)` }}>
        {r.example && <PreparedTag>{PREPARED_COPY.rewardsTag}</PreparedTag>}
        <p className="mt-3 font-display text-3xl font-bold">{r.title}</p>
        <p className="mt-2 text-white/90">{r.body}</p>
        {!r.example && slots.rewardsProgress?.(model.identity.id)}
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
        <LocationPanel lat={l.lat} lng={l.lng} name={model.identity.name} accent={accent} address={l.address} mapHref={l.mapHref} />
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
