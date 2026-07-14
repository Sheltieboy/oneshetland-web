import { redirect } from "next/navigation";

// Merged into the single unified work profile at /work-profile.
export default function ShiftWorkProfileRedirect() {
  redirect("/work-profile");
}
