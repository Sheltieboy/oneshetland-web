import { photoUrl, type Photo } from "@/lib/house-swaps";

/** The advert's photos: the first large, the rest as a tidy grid. Alt text is the member's own description, or a plain default. */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  if (!photos.length) return null;
  return (
    <ul className={"grid gap-2 " + (photos.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")} aria-label={`Photos of ${title}`}>
      {photos.map((p, i) => (
        <li key={p.path} className={i === 0 && photos.length > 1 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(p.path)} alt={p.alt || `Photo ${i + 1} of the home`} loading={i === 0 ? "eager" : "lazy"} className={"h-full w-full rounded-xl object-cover " + (i === 0 ? "aspect-[4/3]" : "aspect-[4/3]")} />
        </li>
      ))}
    </ul>
  );
}
