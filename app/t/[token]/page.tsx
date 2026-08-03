import type { Metadata } from "next";
import { TileOpen } from "./TileOpen";

/**
 * /t/{token} — where an NFC tile lands.
 *
 * On a phone with the app installed this page is normally never seen: iOS and
 * Android hand the URL straight to the app (see the two .well-known routes).
 * It's the fallback for everyone else — app not installed, tapped on a laptop,
 * or link verification not yet propagated.
 *
 * Deliberately does NOT look the token up. Tile tokens are the credential the
 * stamp and wallet-pay functions accept, so resolving them for anonymous
 * visitors would turn this page into a lookup table mapping tokens to shops.
 * The app resolves the token itself, over an authenticated RPC.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open in OneShetland",
  description: "Tap a OneShetland tile to collect a loyalty stamp or pay from your wallet.",
  robots: { index: false, follow: false },
};

export default async function TilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-navy text-3xl">📲</span>

      <h1 className="mt-5 font-display text-3xl font-bold text-ink">You tapped a OneShetland tile</h1>
      <p className="mt-2 text-ink-soft">
        Open it in the app to collect your loyalty stamp or pay from your Local Wallet.
      </p>

      <TileOpen token={token} />

      <div className="mt-10 w-full rounded-card border border-line bg-white p-5 text-left shadow-soft">
        <p className="font-display font-bold text-navy">Haven&rsquo;t got the app?</p>
        <p className="mt-1 text-sm text-ink-soft">
          OneShetland is free — what&rsquo;s on, local businesses, the fishing fleet, jobs, community
          hubs and more, all in one place. Once it&rsquo;s installed, tap the tile again and it&rsquo;ll
          open straight to this shop.
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-pill bg-navy px-5 py-2.5 text-sm font-bold text-white"
        >
          About OneShetland
        </a>
      </div>

      <p className="mt-6 text-xs text-ink-muted">
        Nothing is charged by tapping. You approve every payment on your own phone.
      </p>
    </div>
  );
}
