import type { AfterCancel, CancelPanel } from "@/lib/event-cancel-panel";
import { SUPPORT_EMAIL } from "@/lib/contributor-copy";

/**
 * Body of the confirm / result dialogs when an organiser cancels an event that sells OneShetland tickets. Plain <a> links (not next/link) on purpose:
 * the dialog lives in a root provider and would stay open across a client-side navigation; a normal navigation closes it.
 */
export function CancelBefore({ panel, ordersHref }: { panel: CancelPanel; ordersHref: string }) {
  return (
    <div className="space-y-3 text-left">
      <p className="font-semibold text-ink">{panel.summary}</p>
      <div>
        <p className="font-semibold text-ink">When you cancel, OneShetland will:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">{panel.willDo.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      {panel.willNot.length > 0 && (
        <div>
          <p className="font-semibold text-ink">OneShetland will not:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{panel.willNot.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {!panel.nobody && <p>{panel.refund} <a href={ordersHref} className="font-semibold text-navy underline">{panel.ordersLabel}</a></p>}
      <p>{panel.supportLead} <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy underline">{SUPPORT_EMAIL}</a>.</p>
    </div>
  );
}

export function CancelAfter({ result, ordersHref, showOrders }: { result: AfterCancel; ordersHref: string; showOrders: boolean }) {
  return (
    <div className="space-y-2 text-left">
      {result.lines.map((l) => <p key={l}>{l}</p>)}
      {showOrders && <p><a href={ordersHref} className="font-semibold text-navy underline">{result.ordersLabel}</a></p>}
      <p>{result.supportLead} <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy underline">{SUPPORT_EMAIL}</a>.</p>
    </div>
  );
}
