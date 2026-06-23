import Link from "next/link";
import { hubAccent, HUB_TYPE_LABELS, type Hub } from "@/lib/hubs-data";
import { HubTypeIcon } from "./HubTypeIcon";

export function HubCard({ hub }: { hub: Hub }) {
  const accent = hubAccent(hub);
  return (
    <Link
      href={`/hubs/${hub.slug || hub.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:shadow-lift"
    >
      {/* Brand banner */}
      <div className="relative h-28" style={{ background: accent }}>
        {hub.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hub.cover_url} alt="" className="h-full w-full object-cover opacity-90" />
        )}
      </div>

      <div className="px-5 pb-5">
        {/* Icon / logo badge overlapping the banner */}
        <div
          className="relative z-10 -mt-9 mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-line bg-paper shadow-soft"
          style={{ color: accent }}
        >
          {hub.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hub.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <HubTypeIcon type={hub.type} className="h-7 w-7" />
          )}
          {!hub.logo_url && <span className="sr-only">{HUB_TYPE_LABELS[hub.type]}</span>}
        </div>

        <h3 className="font-display text-xl font-bold text-ink group-hover:underline">{hub.name}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          {HUB_TYPE_LABELS[hub.type]}
          {hub.is_verified && <> · <span className="font-semibold" style={{ color: accent }}>Verified</span></>}
          {hub.area ? ` · ${hub.area}` : ""}
        </p>
        {hub.description && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{hub.description}</p>
        )}
      </div>
    </Link>
  );
}
