import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-data.server";
import { frontDoorAccess } from "@/lib/event-front-door";
import { FrontDoor } from "@/components/events/front-door/FrontDoor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add an Event or Activity", robots: { index: false, follow: false } };

/**
 * HIDDEN. Not linked from navigation, footers, empty states or the sitemap. Opens only when the server-only variable
 * EVENT_FRONT_DOOR is "on", or for a signed-in administrator previewing it; otherwise it is a 404.
 */
export default async function AddPage() {
  const flag = process.env.EVENT_FRONT_DOOR;
  const access = frontDoorAccess({ flag, isStaff: flag === "on" ? false : await isAdmin() });
  if (access === "hidden") notFound();
  return <FrontDoor submissionsOpen={false} />;
}
