import { getContentReview } from "@/lib/editions/data.server";
import { ContentReviewNotice } from "./ContentReviewNotice";

/** Reads the open warnings on the server and hands them to the panel. Renders nothing when there are none. */
export async function ContentReviewPanel({ editionId, organiserSlug, editionSlug }: { editionId: string; organiserSlug: string; editionSlug: string }) {
  const notices = await getContentReview(editionId);
  if (!notices.length) return null;
  return <ContentReviewNotice notices={notices} organiserSlug={organiserSlug} editionSlug={editionSlug} />;
}
