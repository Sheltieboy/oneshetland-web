import { GiftClaimClient } from "./GiftClaimClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  await params;
  return { title: "You've got a gift · OneShetland" };
}

export default async function GiftClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="mx-auto max-w-lg px-5 py-10 sm:py-14">
      <GiftClaimClient code={code} />
    </div>
  );
}
