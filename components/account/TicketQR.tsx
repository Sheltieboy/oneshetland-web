"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * TicketQR — a scannable QR of the ticket's backup code, so a web ticket can be
 * scanned at the door (the raw token only ever lives on the buyer's app device).
 * validate-event-ticket falls back to treating a scanned QR as a backup code.
 */
export function TicketQR({ code }: { code: string }) {
  return (
    <div className="shrink-0 rounded-lg bg-white p-1.5 shadow-sm" title="Scan at the door">
      <QRCodeSVG value={code} size={68} level="M" />
    </div>
  );
}
