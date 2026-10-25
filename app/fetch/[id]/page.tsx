import { redirect } from "next/navigation";

// Fetch v1 request page. v2 keeps one page per party: the request page sends a driver on to their job page.
export default async function OldFetchRequest({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/fetch/requests/${(await params).id}`);
}
