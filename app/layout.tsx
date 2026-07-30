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
import { PrelaunchNotice } from "@/components/site/PrelaunchNotice";
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
    default: "OneShetland — everything Shetland, in one place",
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
    title: "OneShetland — everything Shetland, in one place",
    description:
      "What's on, local businesses, the fishing fleet, the Shetland dialect, community hubs, jobs and more — one warm home for the islands.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OneShetland — everything Shetland, in one place",
    description:
      "Everything Shetland, in one place — built for the islands, by the islands.",
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
                "Everything Shetland in one place — what's on, local businesses, the fishing fleet, the Shetland dialect, community hubs and jobs.",
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
        <ChargeApprovalListener />
        <ConsentBanner />
        <PrelaunchNotice />
        <ConfirmProvider>
          <SiteHeader user={user} fetchStatus={fetchStatus} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ConfirmProvider>
      </body>
    </html>
  );
}
