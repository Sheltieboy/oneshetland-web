import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Fetch v2 administrator notifications link to /admin/fetch/requests/<id> (Step 8); the job page lives at /admin/fetch/jobs/<id>. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  redirect(`/admin/fetch/jobs/${id}`);
}
