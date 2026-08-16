"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The help content itself, kept apart from the "?" mechanism so topics are
 * cheap to add and easy to read as prose.
 *
 * HOW TO WRITE ONE.
 * Answer "what do I actually do?" — not "what is this called". Lead with the
 * thing the person is trying to achieve. Short sentences. No feature names
 * they haven't met yet. If the answer involves another person or another
 * device, draw it.
 *
 * AND FINISH THE JOB. If the honest answer is "the thing you want is on a
 * different screen", say which one and link to it. A topic that correctly
 * identifies what someone needs and then strands them has only done half the
 * work — see ManageLinks below.
 */

/**
 * Links to sibling screens under the same business.
 *
 * Derives the business from the URL rather than taking an id prop, so topics
 * stay plain data and any page under /business/<id>/manage/… can use them
 * without threading ids through the HelpTip API. Renders nothing anywhere else,
 * so a topic carrying these is still safe to show on a non-business page.
 */
function ManageLinks({ items }: { items: { slug: string; label: string }[] }) {
  const pathname = usePathname() ?? "";
  const base = pathname.match(/^(\/business\/[^/]+\/manage)/)?.[1];
  if (!base) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.slug}
          href={`${base}/${i.slug}`}
          className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-navy hover:bg-sand"
        >
          {i.label} →
        </Link>
      ))}
    </div>
  );
}

const NAVY = "#032f4c";
const TEAL = "#12b3d6";
const LOCAL = "#7c3aed";
const INK_SOFT = "#5b6b78";
const LINE = "#d9d2c7";
const SAND = "#f2ede4";

export type HelpTopicId =
  | "till-code"
  | "loyalty-stamps"
  | "claim-evidence"
  | "what-to-sell"
  | "wallet-payment"
  | "trade-availability"
  | "nfc-tile"
  | "booking-setup"
  | "addons-tier"
  | "analytics-revenue"
  | "add-business";

type Topic = {
  title: string;
  subtitle?: string;
  accent: string;
  diagram?: ReactNode;
  body: ReactNode;
};

/* ── shared drawing bits ─────────────────────────────────────────────────── */

/** A phone outline with a caption underneath. */
function Phone({
  x,
  label,
  screen,
  accent,
}: {
  x: number;
  label: string;
  screen: ReactNode;
  accent: string;
}) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="0" width="76" height="128" rx="12" fill="#fff" stroke={LINE} strokeWidth="2" />
      <rect x="26" y="6" width="24" height="4" rx="2" fill={LINE} />
      {screen}
      <text
        x="38"
        y="150"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={accent}
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

/** Dashed arrow. `dir` is which way the code is travelling. */
function Arrow({
  x,
  y,
  w,
  label,
  dir = "right",
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  dir?: "right" | "left";
}) {
  const tipX = dir === "right" ? x + w : x;
  const tailX = dir === "right" ? x + w - 10 : x + 10;
  return (
    <g>
      <line x1={tailX} y1={y} x2={dir === "right" ? x : x + w} y2={y} stroke={INK_SOFT} strokeWidth="2" strokeDasharray="5 4" />
      <polygon points={`${tipX},${y} ${tailX},${y - 5} ${tailX},${y + 5}`} fill={INK_SOFT} />
      <text x={x + w / 2} y={y - 12} textAnchor="middle" fontSize="12" fill={INK_SOFT} fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
}

function Figure({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="rounded-xl border border-line bg-paper p-4">
      {children}
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-ink-muted">{caption}</figcaption>
      )}
    </figure>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-ink-soft">{children}</p>;
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-lg font-bold text-ink">{children}</h3>;
}

/* ── topics ──────────────────────────────────────────────────────────────── */

export const HELP_TOPICS: Record<HelpTopicId, Topic> = {
  /* The single most-needed one: two codes, opposite directions, same screen. */
  "till-code": {
    title: "Using the codes at your counter",
    subtitle: "There are two, and they go opposite ways",
    accent: NAVY,
    diagram: (
      <Figure caption="The code always travels towards whoever needs to type it in.">
        <svg viewBox="0 0 560 194" className="w-full" role="img" aria-label="Two diagrams side by side. Giving a stamp: your screen shows a code, the customer reads it and types it into their phone. Taking a payment: the customer shows you their member code, and you type it in with the amount.">
          <text x="135" y="14" textAnchor="middle" fontSize="13" fontWeight="700" fill={NAVY} fontFamily="system-ui, sans-serif">Giving a stamp</text>
          <g transform="translate(0 26)">
            <Phone x={30} label="You" accent={NAVY} screen={<>
              <rect x="12" y="40" width="52" height="26" rx="6" fill={SAND} />
              <text x="38" y="58" textAnchor="middle" fontSize="15" fontWeight="700" fill={NAVY} fontFamily="ui-monospace, monospace">4192</text>
              <text x="38" y="84" textAnchor="middle" fontSize="9" fill={INK_SOFT} fontFamily="system-ui, sans-serif">show this</text>
            </>} />
            <Arrow x={114} y={64} w={56} label="reads it" />
            <Phone x={178} label="Customer" accent={INK_SOFT} screen={<>
              <rect x="12" y="40" width="52" height="26" rx="6" fill="#fff" stroke={TEAL} strokeWidth="2" />
              <text x="38" y="58" textAnchor="middle" fontSize="15" fontWeight="700" fill={TEAL} fontFamily="ui-monospace, monospace">4192</text>
              <text x="38" y="84" textAnchor="middle" fontSize="9" fill={INK_SOFT} fontFamily="system-ui, sans-serif">types it in</text>
            </>} />
          </g>

          <line x1="280" y1="8" x2="280" y2="186" stroke={LINE} strokeWidth="2" />

          <text x="420" y="14" textAnchor="middle" fontSize="13" fontWeight="700" fill={LOCAL} fontFamily="system-ui, sans-serif">Taking a payment</text>
          <g transform="translate(0 26)">
            <Phone x={300} label="Customer" accent={INK_SOFT} screen={<>
              <rect x="12" y="40" width="52" height="26" rx="6" fill={SAND} />
              <text x="38" y="58" textAnchor="middle" fontSize="14" fontWeight="700" fill={LOCAL} fontFamily="ui-monospace, monospace">SH-72</text>
              <text x="38" y="84" textAnchor="middle" fontSize="9" fill={INK_SOFT} fontFamily="system-ui, sans-serif">shows you</text>
            </>} />
            {/* Points back towards the shop — this code travels the other way. */}
            <Arrow x={384} y={64} w={56} label="you type it" dir="left" />
            <Phone x={448} label="You" accent={LOCAL} screen={<>
              <rect x="12" y="40" width="52" height="26" rx="6" fill="#fff" stroke={LOCAL} strokeWidth="2" />
              <text x="38" y="58" textAnchor="middle" fontSize="14" fontWeight="700" fill={LOCAL} fontFamily="ui-monospace, monospace">SH-72</text>
              <text x="38" y="84" textAnchor="middle" fontSize="9" fill={INK_SOFT} fontFamily="system-ui, sans-serif">+ amount</text>
            </>} />
          </g>
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          Two codes live on this page and they travel in opposite directions. That&apos;s the bit
          that catches folk out.
        </P>
        <div>
          <H>Giving a stamp or a reward</H>
          <P>
            The code on your screen changes every few seconds. Read it out, or turn the screen
            round. The customer types it into their OneShetland app and the stamp lands on their
            card there and then.
          </P>
        </div>
        <div>
          <H>Taking a payment from their wallet</H>
          <P>
            The other way round. Ask for{" "}<em>their</em>{" "}
            member code — it&apos;s in their app on their card — and type it in here with the
            amount. They approve it on their own phone before anything moves.
          </P>
        </div>
        <P>
          Nothing is taken until they tap approve. If they don&apos;t, the request simply expires
          and nobody has paid anything.
        </P>
      </>
    ),
  },

  "loyalty-stamps": {
    title: "How stamps work",
    subtitle: "A paper loyalty card, without the paper",
    accent: NAVY,
    diagram: (
      <Figure caption="You choose how many stamps, and what they earn.">
        <svg viewBox="0 0 420 120" className="w-full" role="img" aria-label="A loyalty card with ten circles, seven of them stamped, leading to a reward.">
          <rect x="8" y="18" width="270" height="84" rx="12" fill="#fff" stroke={LINE} strokeWidth="2" />
          <text x="24" y="40" fontSize="12" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">DA COFFEE SHOP</text>
          {Array.from({ length: 10 }).map((_, i) => {
            const filled = i < 7;
            const cx = 32 + (i % 5) * 50;
            const cy = i < 5 ? 62 : 88;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="13" fill={filled ? TEAL : "#fff"} stroke={filled ? TEAL : LINE} strokeWidth="2" />
                {filled && <path d={`M${cx - 5} ${cy} l4 4 l7 -8`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          })}
          <g transform="translate(300 0)">
            <line x1="-14" y1="60" x2="14" y2="60" stroke={INK_SOFT} strokeWidth="2" strokeDasharray="5 4" />
            <polygon points="22,60 12,55 12,65" fill={INK_SOFT} />
            <rect x="30" y="34" width="82" height="52" rx="10" fill={SAND} stroke={NAVY} strokeWidth="2" />
            <text x="71" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill={NAVY} fontFamily="system-ui, sans-serif">Free</text>
            <text x="71" y="74" textAnchor="middle" fontSize="13" fontWeight="700" fill={NAVY} fontFamily="system-ui, sans-serif">coffee</text>
          </g>
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          You decide how many stamps earn a reward and what that reward is. Ten coffees and the
          eleventh is on you — whatever suits the shop.
        </P>
        <P>
          A customer collects a stamp at your counter: either they type your till code into their
          app, or they tap an NFC tile if you have one.
        </P>
        <P>
          When a card fills up, their app shows the reward. You confirm it here, the card resets,
          and away they go again.
        </P>
        <P>
          You can change the scheme or stop it whenever you like. Stamps already collected stay
          where they are — folk have earned those.
        </P>
      </>
    ),
  },

  "claim-evidence": {
    title: "Claiming your listing",
    subtitle: "What counts as proof it's yours",
    accent: LOCAL,
    diagram: (
      <Figure caption="Any one of these is plenty. You don't need them all.">
        {/* 124 not 112: the second caption line sits at y=112, and its
            descenders were clipping on the viewBox edge. */}
        <svg viewBox="0 0 420 124" className="w-full" role="img" aria-label="Three examples of proof: a bill with the business name, an email at the business domain, and access to its social media page.">
          {[
            { x: 8, l1: "A bill or", l2: "invoice" },
            { x: 148, l1: "An email at", l2: "your domain" },
            { x: 288, l1: "Your Facebook", l2: "or Instagram" },
          ].map((c) => (
            <g key={c.x} transform={`translate(${c.x} 8)`}>
              <rect x="0" y="0" width="124" height="76" rx="10" fill="#fff" stroke={LINE} strokeWidth="2" />
              <rect x="14" y="16" width="70" height="5" rx="2.5" fill={LINE} />
              <rect x="14" y="29" width="94" height="5" rx="2.5" fill={LINE} />
              <rect x="14" y="42" width="52" height="5" rx="2.5" fill={LINE} />
              <circle cx="100" cy="56" r="13" fill={LOCAL} />
              <path d="M94 56 l4 4 l8 -9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x="62" y="98" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{c.l1}</text>
              <text x="62" y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{c.l2}</text>
            </g>
          ))}
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          We only need something showing you&apos;re connected to the business. Any{" "}<em>one</em>{" "}of
          these does it:
        </P>
        <ul className="ml-5 list-disc space-y-1.5 text-ink-soft">
          <li>A bill, invoice or statement with the business name on it</li>
          <li>An email address at the business&apos;s own domain</li>
          <li>Access to its Facebook or Instagram page</li>
          <li>A photo of you at the premises, or of the signage</li>
        </ul>
        <P>
          Haven&apos;t any of that to hand? Plenty of small Shetland businesses won&apos;t. Just
          tell us who you are and how you&apos;re connected — if we know the place, or can ring and
          ask, that&apos;s usually enough.
        </P>
        <P>
          Nothing on your listing changes until it&apos;s approved, and we&apos;ll email you either
          way.
        </P>
      </>
    ),
  },

  "what-to-sell": {
    title: "Which one do I need?",
    subtitle: "Products, services, passes and offers",
    accent: LOCAL,
    diagram: (
      <Figure caption="Ask whether it has a time. Yes → service. No, and they take it away → product.">
        <svg viewBox="0 0 420 160" className="w-full" role="img" aria-label="Four boxes: product is a thing you hand over, service is a slot in your day, pass is bought now and used later, offer is a deal on what you already do.">
          {[
            { x: 8, y: 8, t: "Product", d: "A thing you", d2: "hand over", c: NAVY },
            { x: 216, y: 8, t: "Service", d: "A slot in", d2: "your day", c: TEAL },
            { x: 8, y: 88, t: "Pass", d: "Bought now,", d2: "used later", c: LOCAL },
            { x: 216, y: 88, t: "Offer", d: "A deal on what", d2: "you already do", c: "#c8811a" },
          ].map((b) => (
            <g key={b.t} transform={`translate(${b.x} ${b.y})`}>
              <rect x="0" y="0" width="196" height="64" rx="10" fill="#fff" stroke={b.c} strokeWidth="2" />
              <rect x="0" y="0" width="5" height="64" rx="2.5" fill={b.c} />
              <text x="18" y="26" fontSize="14" fontWeight="700" fill={b.c} fontFamily="system-ui, sans-serif">{b.t}</text>
              <text x="18" y="43" fontSize="12" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{b.d}</text>
              <text x="18" y="57" fontSize="12" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{b.d2}</text>
            </g>
          ))}
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>Four things that sound alike. The quick way to tell them apart:</P>
        <ul className="space-y-2 text-ink-soft">
          <li>
           {" "}<strong className="font-semibold text-ink">Product</strong>{" "}— something you hand over. A
            jumper, a bag of coffee, a jar of chutney.
          </li>
          <li>
           {" "}<strong className="font-semibold text-ink">Service</strong>{" "}— a slot in your day. A
            haircut, a lesson, a table at seven.
          </li>
          <li>
           {" "}<strong className="font-semibold text-ink">Pass</strong>{" "}— bought now, used whenever. A
            class pack, a day pass, a gift voucher.
          </li>
          <li>
           {" "}<strong className="font-semibold text-ink">Offer</strong>{" "}— not a thing you sell at all.
            It&apos;s a deal on what you already do: ten per cent off Tuesdays, a free coffee with a
            bacon roll.
          </li>
        </ul>
        <P>
          Still stuck? Ask whether it has a{" "}<em>time</em>. If yes, it&apos;s a service. If no but
          they carry it out the door, it&apos;s a product. If no and they&apos;ll use it whenever
          they like, it&apos;s a pass.
        </P>
        <P>
          Each one has its own screen. If what you&apos;re adding isn&apos;t a product, you want
          one of these:
        </P>
        <ManageLinks
          items={[
            { slug: "services", label: "Services" },
            { slug: "passes", label: "Passes & packs" },
            { slug: "offers", label: "Offers" },
          ]}
        />
      </>
    ),
  },

  "wallet-payment": {
    title: "Taking a wallet payment",
    subtitle: "They approve it on their own phone",
    accent: LOCAL,
    diagram: (
      <Figure caption="Nothing moves until they tap approve on their own phone.">
        <svg viewBox="0 0 420 78" className="w-full" role="img" aria-label="Three steps: you enter their code and the amount, it appears on their phone to approve, then the money is in your takings.">
          {[
            { n: "1", t: "You enter their", t2: "code + amount" },
            { n: "2", t: "They approve", t2: "on their phone" },
            { n: "3", t: "In your", t2: "takings" },
          ].map((s, i) => (
            <g key={s.n} transform={`translate(${i * 145} 0)`}>
              <rect x="0" y="8" width="120" height="58" rx="10" fill="#fff" stroke={LINE} strokeWidth="2" />
              <circle cx="22" cy="30" r="11" fill={LOCAL} />
              <text x="22" y="35" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{s.n}</text>
              <text x="40" y="30" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.t}</text>
              <text x="40" y="46" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.t2}</text>
              {i < 2 && (
                <>
                  <line x1="124" y1="37" x2="136" y2="37" stroke={INK_SOFT} strokeWidth="2" strokeDasharray="4 3" />
                  <polygon points="143,37 133,32 133,42" fill={INK_SOFT} />
                </>
              )}
            </g>
          ))}
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          Ask the customer for their member code — it&apos;s in their app, on their card — then
          type it in here with the amount.
        </P>
        <P>
          The request goes to their phone and they approve it there. You&apos;ll see it confirm on
          your screen. Nothing is taken from them until they tap.
        </P>
        <P>
          If they don&apos;t approve within a minute or so the request expires and you can start
          again. If a payment fails,{" "}<strong className="font-semibold text-ink">they have not been
          charged</strong>{" "}— that message means exactly what it says, so just try again.
        </P>
      </>
    ),
  },

  "trade-availability": {
    title: "Why leads stop arriving",
    subtitle: "Availability is the switch",
    accent: "#c8811a",
    diagram: (
      <Figure caption="Set to unavailable — or left to go stale — and nothing reaches you.">
        <svg viewBox="0 0 420 92" className="w-full" role="img" aria-label="Two states. Available: a job brief reaches you. Unavailable: it does not.">
          <g>
            <rect x="8" y="10" width="190" height="72" rx="10" fill="#fff" stroke="#2f9e5e" strokeWidth="2" />
            <text x="24" y="34" fontSize="13" fontWeight="700" fill="#2f9e5e" fontFamily="system-ui, sans-serif">Available</text>
            <text x="24" y="54" fontSize="12" fill={INK_SOFT} fontFamily="system-ui, sans-serif">A brief comes in →</text>
            <text x="24" y="70" fontSize="12" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">it reaches you</text>
          </g>
          <g>
            <rect x="222" y="10" width="190" height="72" rx="10" fill={SAND} stroke={LINE} strokeWidth="2" />
            <text x="238" y="34" fontSize="13" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">Unavailable</text>
            <text x="238" y="54" fontSize="12" fill={INK_SOFT} fontFamily="system-ui, sans-serif">A brief comes in →</text>
            <text x="238" y="70" fontSize="12" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">it goes elsewhere</text>
          </g>
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          When somebody posts a job on Get It Done, we only put it in front of trades who are
          marked available and who cover that kind of work.
        </P>
        <P>
          So if the leads have dried up, this is nearly always why. Check three things:
          you&apos;re set to available, your trades are ticked, and your minimum job size
          isn&apos;t set higher than the work coming in.
        </P>
        <P>
          It&apos;s worth glancing at whenever you get busy and turn it off — it&apos;s easy to
          set it in March and wonder in June where everybody&apos;s gone.
        </P>
      </>
    ),
  },

  "nfc-tile": {
    title: "The tap-to-stamp tile",
    subtitle: "A wee sticker for your counter",
    accent: NAVY,
    diagram: (
      <Figure caption="Once it's stuck down and activated, that's it — no screens, no typing.">
        <svg viewBox="0 0 420 88" className="w-full" role="img" aria-label="Three steps: request the tile, it arrives in the post and you stick it on the counter, then customers tap it with their phone.">
          {[
            { n: "1", t: "You request it", t2: "here — it's free" },
            { n: "2", t: "It arrives, you", t2: "stick it down" },
            { n: "3", t: "Customers tap", t2: "it with a phone" },
          ].map((s, i) => (
            <g key={s.n} transform={`translate(${i * 145} 0)`}>
              <rect x="0" y="8" width="120" height="64" rx="10" fill="#fff" stroke={LINE} strokeWidth="2" />
              <circle cx="22" cy="32" r="11" fill={NAVY} />
              <text x="22" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{s.n}</text>
              <text x="40" y="32" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.t}</text>
              <text x="40" y="48" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.t2}</text>
              {i < 2 && (
                <>
                  <line x1="124" y1="40" x2="136" y2="40" stroke={INK_SOFT} strokeWidth="2" strokeDasharray="4 3" />
                  <polygon points="143,40 133,35 133,45" fill={INK_SOFT} />
                </>
              )}
            </g>
          ))}
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          A small branded tile that sticks on your counter. A customer holds their phone near it
          and collects a stamp — no code to read out, nothing to type.
        </P>
        <P>
          It&apos;s included with your subscription and we post it within three working days. When
          it turns up, stick it somewhere folk can reach it and tap it once yourself with the app
          to switch it on.
        </P>
        <P>
          You&apos;ll need your address and map location filled in on your Profile before you can
          request one — otherwise we&apos;ve nowhere to send it.
        </P>
      </>
    ),
  },

  "booking-setup": {
    title: "Getting bookings working",
    subtitle: "Three pages, in this order",
    accent: TEAL,
    diagram: (
      <Figure caption="Set up the first two and the third fills itself.">
        <svg viewBox="0 0 420 92" className="w-full" role="img" aria-label="Services first, then Schedule, then Bookings arrive on their own.">
          {[
            { n: "1", t: "Services", d: "what you offer,", d2: "how long, price" },
            { n: "2", t: "Schedule", d: "the hours you're", d2: "open to bookings" },
            { n: "3", t: "Bookings", d: "these arrive on", d2: "their own" },
          ].map((s, i) => (
            <g key={s.n} transform={`translate(${i * 145} 0)`}>
              <rect x="0" y="8" width="120" height="70" rx="10" fill={i === 2 ? SAND : "#fff"} stroke={i === 2 ? LINE : TEAL} strokeWidth="2" />
              <text x="14" y="30" fontSize="13" fontWeight="700" fill={i === 2 ? INK_SOFT : TEAL} fontFamily="system-ui, sans-serif">{s.n}. {s.t}</text>
              <text x="14" y="48" fontSize="11" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.d}</text>
              <text x="14" y="63" fontSize="11" fill={INK_SOFT} fontFamily="system-ui, sans-serif">{s.d2}</text>
              {i < 2 && (
                <>
                  <line x1="124" y1="43" x2="136" y2="43" stroke={INK_SOFT} strokeWidth="2" strokeDasharray="4 3" />
                  <polygon points="143,43 133,38 133,48" fill={INK_SOFT} />
                </>
              )}
            </g>
          ))}
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          Bookings need two things set up first, and the order matters — it&apos;s the usual reason
          nothing appears.
        </P>
        <P>
         {" "}<strong className="font-semibold text-ink">Services</strong>{" "}are what somebody can book:
          a cut and blow-dry, an hour&apos;s lesson, a table. Each one has a length and a price.
        </P>
        <P>
         {" "}<strong className="font-semibold text-ink">Schedule</strong>{" "}is when you&apos;re open to
          take them, plus any days you&apos;re shut.
        </P>
        <P>
          Once both are done, people can book — and those bookings turn up on the{" "}
         {" "}<strong className="font-semibold text-ink">Bookings</strong>{" "}page. You don&apos;t add
          anything there yourself.
        </P>
      </>
    ),
  },

  "addons-tier": {
    title: "Plans and add-ons",
    subtitle: "What you're paying for, and what you're not",
    accent: NAVY,
    diagram: (
      <Figure caption="Your plan sets the floor. Add-ons are extras you switch on one at a time.">
        <svg viewBox="0 0 420 96" className="w-full" role="img" aria-label="A plan gives you a set of features. Add-ons sit on top and are switched on individually.">
          <rect x="8" y="12" width="180" height="72" rx="10" fill="#fff" stroke={NAVY} strokeWidth="2" />
          <text x="24" y="36" fontSize="13" fontWeight="700" fill={NAVY} fontFamily="system-ui, sans-serif">Your plan</text>
          <text x="24" y="55" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">Free, Pro or Premium.</text>
          <text x="24" y="70" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">One monthly price.</text>
          <text x="200" y="52" fontSize="20" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">+</text>
          <rect x="232" y="12" width="180" height="72" rx="10" fill={SAND} stroke={LINE} strokeWidth="2" />
          <text x="248" y="36" fontSize="13" fontWeight="700" fill={INK_SOFT} fontFamily="system-ui, sans-serif">Add-ons</text>
          <text x="248" y="55" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">Only the extras you</text>
          <text x="248" y="70" fontSize="11.5" fill={INK_SOFT} fontFamily="system-ui, sans-serif">choose. Off by default.</text>
        </svg>
      </Figure>
    ),
    body: (
      <>
        <P>
          Your{" "}<strong className="font-semibold text-ink">plan</strong>{" "}is the monthly
          subscription. Moving up a plan unlocks a set of things at once — loyalty, bookings,
          selling — and each plan page lists exactly what.
        </P>
        <P>
         {" "}<strong className="font-semibold text-ink">Add-ons</strong>{" "}are separate extras you turn
          on individually, like detailed analytics or urgent alerts. Nothing is on unless you
          switched it on.
        </P>
        <P>
          Both renew monthly until you cancel, and you cancel from here — no phone call, no notice
          period. You keep what you&apos;ve paid for until the end of the month you&apos;ve
          already paid.
        </P>
        <P>
          Being{" "}<strong className="font-semibold text-ink">listed</strong>{" "}in the directory is free
          and always will be. None of this is needed to appear on OneShetland.
        </P>
      </>
    ),
  },

  "analytics-revenue": {
    title: "Reading these numbers",
    subtitle: "Including why money may be blank",
    accent: NAVY,
    body: (
      <>
        <P>
         {" "}<strong className="font-semibold text-ink">Views</strong>{" "}is how many folk opened your
          listing.{" "}<strong className="font-semibold text-ink">Contacts</strong>{" "}is how many then
          did something about it — tapped your phone number, your website or your directions.
          That second one is the one worth watching.
        </P>
        <P>
          If{" "}<strong className="font-semibold text-ink">money in</strong>{" "}is blank rather than
          £0, it means we&apos;re not able to show it on your current plan — not that you took
          nothing. We&apos;d rather leave it empty than print £0 at somebody who took £400 that
          week.
        </P>
        <P>
          Everything is the last 30 days, and a brand-new listing will sit at zero for a while.
          That&apos;s normal — it takes a few weeks before the numbers mean anything.
        </P>
      </>
    ),
  },

  "add-business": {
    title: "Adding your business",
    subtitle: "What it costs and what happens next",
    accent: LOCAL,
    body: (
      <>
        <P>
          Being listed is{" "}<strong className="font-semibold text-ink">free</strong>, and stays free.
          You don&apos;t need a card, a bank account or a subscription to appear on OneShetland.
        </P>
        <P>
          Fill in what you can — the name, where you are and how to get hold of you is plenty to
          start. Opening hours, photos and the rest can come later, and a half-finished listing is
          still better than none.
        </P>
        <P>
          It&apos;s yours from the moment you add it. Edit it, hide it or delete it whenever you
          like.
        </P>
        <P>
          Before you add one, it&apos;s worth searching the directory first — there are already
          over 500 Shetland businesses on there from public sources, and yours may be one of them
          waiting to be claimed.
        </P>
      </>
    ),
  },
};
