import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getAccount, accountName } from "@/lib/auth";
import { getFetchStatusSummary } from "@/lib/fetch-data.server";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ChargeApprovalListener } from "@/components/wallet/ChargeApprovalListener";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { JsonLd } from "@/components/seo/JsonLd";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#17395B",
};

export const metadata: Metadata = {
  title: {
    default: "Shop Shetland. Discover Shetland. OneShetland.",
    template: "%s · OneShetland",
  },
  description:
    "What's on, local businesses, the fishing fleet, the Shetland dialect, community hubs, jobs and more — one warm home for the islands.",
  metadataBase: new URL("https://oneshetland.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "OneShetland",
    locale: "en_GB",
    url: "https://oneshetland.com",
    title: "Shop Shetland. Discover Shetland. OneShetland.",
    description:
      "What's on, local businesses, the fishing fleet, the Shetland dialect, community hubs, jobs and more — one warm home for the islands.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop Shetland. Discover Shetland. OneShetland.",
    description:
      "Shop Shetland. Discover Shetland. OneShetland. Built for the islands, by the islands.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await getAccount();
  const user = account
    ? { name: accountName(account), avatarUrl: account.profile?.avatar_url ?? null }
    : null;
  const fetchStatus = account
    ? { userId: account.id, ...(await getFetchStatusSummary(account.id)) }
    : null;

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://oneshetland.com/#org",
              name: "OneShetland",
              url: "https://oneshetland.com",
              logo: "https://oneshetland.com/icon.png",
              description:
                "Shop Shetland. Discover Shetland. OneShetland. What's on, local businesses, the fishing fleet, the Shetland dialect, community hubs and jobs.",
              areaServed: { "@type": "Place", name: "Shetland Islands, Scotland" },
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://oneshetland.com/#website",
              name: "OneShetland",
              url: "https://oneshetland.com",
              publisher: { "@id": "https://oneshetland.com/#org" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://oneshetland.com/directory?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <AnalyticsProvider />
        <ConsentBanner />
        {/* The welcome mat (components/site/PrelaunchNotice.tsx) used to mount
            here. Because this is the ROOT layout it greeted every first-time
            visitor on every route — including someone who had deliberately
            navigated to sign in or create an account, where a modal asking them
            to "join" sits on top of the form they were already filling in.
            The component is kept, unchanged and unused, so it can be brought
            back for a campaign or a future launch moment; only the automatic
            mount is gone. Nothing about sign-up, sign-in, auth or onboarding
            moves with it — it never gated any of them, it only covered them. */}
        <ChargeApprovalListener>
          <ConfirmProvider>
            <SiteHeader user={user} fetchStatus={fetchStatus} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </ConfirmProvider>
        </ChargeApprovalListener>
      </body>
    </html>
  );
}
