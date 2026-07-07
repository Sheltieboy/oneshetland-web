import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getAccount, accountName } from "@/lib/auth";
import { getFetchStatusSummary } from "@/lib/fetch-data.server";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";

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

export const metadata: Metadata = {
  title: {
    default: "OneShetland — everything Shetland, in one place",
    template: "%s · OneShetland",
  },
  description:
    "What's on, local businesses, the fishing fleet, the Shetland dialect, community hubs, jobs and more — one warm home for the islands.",
  metadataBase: new URL("https://oneshetland.com"),
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
        <AnalyticsProvider />
        <ConsentBanner />
        <SiteHeader user={user} fetchStatus={fetchStatus} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
