"use client";

import { useState } from "react";
import { WalletTopUpModal } from "./WalletTopUpModal";

export function WalletTopUpButton({
  accent,
  isLoggedIn,
  signInHref,
}: {
  accent: string;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-pill px-5 py-2.5 text-sm font-semibold text-paper transition hover:brightness-95"
        style={{ background: accent }}
      >
        Top up wallet
      </button>
      <WalletTopUpModal
        open={open}
        onClose={() => setOpen(false)}
        accent={accent}
        isLoggedIn={isLoggedIn}
        signInHref={signInHref}
      />
    </>
  );
}
