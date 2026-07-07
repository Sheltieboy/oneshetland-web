import Link from "next/link";
import { FETCH } from "@/lib/fetch-data";

export const metadata = { title: "How Fetch works · OneShetland" };

const CATEGORIES = [
  { icon: "🍕", label: "Takeaway" },
  { icon: "💊", label: "Pharmacy" },
  { icon: "📦", label: "Parcels" },
  { icon: "🛍️", label: "Shopping" },
  { icon: "🛒", label: "Click & collect" },
  { icon: "📫", label: "Other" },
];

const WONT_CARRY = [
  "Alcohol, tobacco or vapes",
  "Cash or cheques",
  "Passengers or taxi services",
  "Live animals",
  "Anything requiring a courier licence",
];

const CUSTOMER_STEPS = [
  { title: "Create a request", body: "Tell us what needs collecting, where from, and where it's going. Takes about two minutes." },
  { title: "A driver picks it up", body: "A local driver already heading that way claims your request and collects your item." },
  { title: "Delivered to your door", body: "You'll be notified when it's on its way, and again when it arrives. Pay only when it's delivered." },
];

const DRIVER_STEPS = [
  { title: "Post a run", body: "Set your departure window, origin and destination, what kinds of items you can carry, and whether you're going via a ferry. Takes about a minute." },
  { title: "Accept the requests that fit", body: "Customer requests along your route appear in your dashboard. Pick the ones that work for your time, vehicle and detour tolerance." },
  { title: "Deliver and get paid", body: "Mark each step done — collected, en route, delivered. Payouts land in your bank via Stripe, usually within a couple of working days." },
];

const DRIVER_TIPS = [
  { icon: "⏱️", text: "Pad your window. Better to under-promise than chase a late ferry." },
  { icon: "💬", text: "Message the customer if you're delayed — they appreciate it." },
  { icon: "📷", text: "Snap a quick photo at drop-off if there's no one in. Saves disputes." },
  { icon: "📍", text: "Use the destination notes — gates, sheds, side doors. Locals know what they mean." },
];

function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold"
            style={{ background: `${FETCH}1a`, color: FETCH }}>{i + 1}</span>
          <div>
            <p className="font-semibold text-ink">{s.title}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CategoryChips({ heading }: { heading: string }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-lg font-bold text-ink">{heading}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-cream/50 px-3 py-1.5 text-sm font-semibold text-ink-soft">
            <span aria-hidden>{c.icon}</span> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function WontCarry({ note }: { note?: string }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-lg font-bold text-ink">What we don&apos;t carry</h2>
      <ul className="mt-3 divide-y divide-line">
        {WONT_CARRY.map((item) => (
          <li key={item} className="flex items-center gap-2.5 py-2.5 text-sm text-ink">
            <span className="text-red-500" aria-hidden>✕</span> {item}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

export default async function FetchAboutPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const isDriver = tab === "driver";

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-white" style={{ background: FETCH }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${FETCH}f2 30%,${FETCH}b0)` }} />
        <div className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
          <Link href={isDriver ? "/fetch?tab=driver" : "/fetch"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 transition hover:text-white">
            <span aria-hidden>←</span> Back to Fetch
          </Link>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
            {isDriver ? "Driving for Fetch" : "How Fetch works"}
          </h1>
          <p className="mt-3 max-w-xl text-white/90">
            {isDriver
              ? "Already heading from Lerwick to Yell? Brae to Sumburgh? Post your run, pick up the requests that fit, and get paid for trips you were making anyway."
              : "Need something collected from Lerwick? Have something to drop off across the isles? Fetch matches you with local drivers already heading that way."}
          </p>
          {/* Tabs */}
          <div className="mt-5 inline-flex gap-1 rounded-pill bg-white/15 p-1 backdrop-blur-sm">
            <Link href="/fetch/about" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (!isDriver ? "bg-white" : "text-white/80 hover:text-white")} style={!isDriver ? { color: FETCH } : undefined}>For customers</Link>
            <Link href="/fetch/about?tab=driver" className={"rounded-pill px-5 py-2 text-sm font-bold transition " + (isDriver ? "bg-white" : "text-white/80 hover:text-white")} style={isDriver ? { color: FETCH } : undefined}>For drivers</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-10 sm:py-12">
        {/* How it works */}
        <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">{isDriver ? "How driving Fetch works" : "How it works"}</h2>
          <Steps steps={isDriver ? DRIVER_STEPS : CUSTOMER_STEPS} />
        </div>

        {/* Getting paid (driver) */}
        {isDriver && (
          <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl" style={{ background: `${FETCH}1a` }}>🏦</span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Getting paid</h2>
                <p className="mt-1 text-sm text-ink-soft">Payouts run through Stripe Connect. Connect your bank account once — payments land automatically after each delivery.</p>
                <Link href="/fetch/connect-bank" className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95" style={{ background: FETCH }}>Connect your bank →</Link>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        <CategoryChips heading={isDriver ? "What you can carry" : "What we deliver"} />

        {/* Won't carry */}
        <WontCarry note={isDriver ? "If a customer asks you to collect something from this list, decline and report it." : undefined} />

        {/* Tips (driver) */}
        {isDriver && (
          <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink">Tips for a smooth run</h2>
            <ul className="mt-3 space-y-2.5">
              {DRIVER_TIPS.map((t) => (
                <li key={t.text} className="flex items-start gap-2.5 text-sm text-ink">
                  <span aria-hidden>{t.icon}</span> {t.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-card border px-6 py-8 text-center" style={{ borderColor: `${FETCH}40`, background: `${FETCH}0d` }}>
          {isDriver ? (
            <>
              <p className="font-display text-2xl font-bold text-ink">Want to drive and earn?</p>
              <p className="mx-auto mt-2 max-w-lg text-ink-soft">Already heading that way? Get paid for the trip.</p>
              <Link href="/fetch/apply" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: FETCH }}>Apply to become a driver →</Link>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-ink">Need something brought over?</p>
              <p className="mx-auto mt-2 max-w-lg text-ink-soft">Pick it up from any Lerwick shop, takeaway or pharmacy and have it delivered along a driver&apos;s route.</p>
              <Link href="/fetch/new" className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-white shadow-soft transition hover:brightness-95" style={{ background: FETCH }}>Request a delivery →</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
