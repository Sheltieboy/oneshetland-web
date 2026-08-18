import { redirect } from "next/navigation";

/**
 * Merged into the Bookings page. Kept as a redirect rather than deleted so
 * existing links, bookmarks and the app's deep links keep working — and because
 * splitting these out is what made taking bookings impossible to complete.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/business/${id}/manage/bookings#services`);
}
