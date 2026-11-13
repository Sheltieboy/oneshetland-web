import { moderateAdvert } from "@/app/house-swaps/actions";
import { STATUS_PLAIN, bedroomsLabel, formatWhen, photoUrl, typeLabel, wantAreasText, wantBedroomsText, type QueueRow } from "@/lib/house-swaps";
import { ActionForm } from "./ActionForm";
import { FeatureChips } from "./Chips";
import { btnDanger, btnPrimary, btnSecondary, fieldCls } from "./Shell";

/** A staff view of one advert, in full, with Approve / Reject / Hide. Functional rather than fancy. */
export function ModerationCard({ r, tab }: { r: QueueRow; tab: string }) {
  return (
    <article className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-pill bg-navy px-2.5 py-1 text-paper">{STATUS_PLAIN[r.moderation_state] ?? r.moderation_state}</span>
        <span className="rounded-pill bg-sand px-2.5 py-1 text-ink-soft">Advert is {STATUS_PLAIN[r.status]?.toLowerCase() ?? r.status}</span>
        {r.data_origin && <span className="rounded-pill border border-line-strong px-2.5 py-1 text-ink-soft">{r.data_origin === "sample" ? "Sample" : r.data_origin === "preview" ? "Preview" : "Live"}</span>}
        {r.open_reports > 0 && <span className="rounded-pill bg-rose-100 px-2.5 py-1 text-rose-900">{r.open_reports} open report{r.open_reports === 1 ? "" : "s"}</span>}
        <span className="text-ink-muted">Updated {formatWhen(r.updated_at)}</span>
      </div>
      <h3 className="mt-3 break-words font-display text-xl font-bold text-ink">{r.headline || "(no headline)"}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="font-bold text-ink-muted">Has</dt><dd className="text-ink">{bedroomsLabel(r.have_bedrooms)} · {typeLabel(r.have_type)} · {r.have_area_name}</dd><dd className="mt-1"><FeatureChips features={r.have_features} /></dd></div>
        <div><dt className="font-bold text-ink-muted">Wants</dt><dd className="text-ink">{wantBedroomsText(r.want_min_bedrooms, r.want_max_bedrooms)}; {wantAreasText(r.want_area_names)}</dd></div>
      </dl>
      {r.description && <div className="mt-3"><p className="text-xs font-bold text-ink-muted">Description</p><p className="whitespace-pre-line break-words text-sm text-ink-soft">{r.description}</p></div>}
      {r.want_notes && <div className="mt-3"><p className="text-xs font-bold text-ink-muted">Looking-for notes</p><p className="whitespace-pre-line break-words text-sm text-ink-soft">{r.want_notes}</p></div>}
      {r.moderation_reason && <p className="mt-3 text-sm text-ink-muted">Reason on record: {r.moderation_reason}</p>}
      {r.photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {r.photos.map((p) => (
            <li key={p.path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={photoUrl(p.path)} target="_blank" rel="noopener noreferrer"><img src={photoUrl(p.path)} alt={p.alt || "Advert photo"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" /><span className="sr-only">(opens full size in a new tab)</span></a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-3">
        <ActionForm action={moderateAdvert} resetOnOk={false}>
          <input type="hidden" name="listing" value={r.id} /><input type="hidden" name="tab" value={tab} /><input type="hidden" name="decision" value="approve" />
          <button type="submit" className={btnPrimary}>Approve</button>
        </ActionForm>
        <ActionForm action={moderateAdvert} resetOnOk className="space-y-2">
          <input type="hidden" name="listing" value={r.id} /><input type="hidden" name="tab" value={tab} /><input type="hidden" name="decision" value="reject" />
          <label htmlFor={`rj-${r.id}`} className="block text-xs font-bold text-ink-muted">Reason (the member sees this)</label>
          <input id={`rj-${r.id}`} name="reason" required maxLength={500} className={fieldCls} />
          <button type="submit" className={btnSecondary}>Reject</button>
        </ActionForm>
        <ActionForm action={moderateAdvert} resetOnOk className="space-y-2">
          <input type="hidden" name="listing" value={r.id} /><input type="hidden" name="tab" value={tab} /><input type="hidden" name="decision" value="hide" />
          <label htmlFor={`hd-${r.id}`} className="block text-xs font-bold text-ink-muted">Reason for hiding</label>
          <input id={`hd-${r.id}`} name="reason" required maxLength={500} className={fieldCls} />
          <button type="submit" className={btnDanger}>Hide</button>
        </ActionForm>
      </div>
    </article>
  );
}
