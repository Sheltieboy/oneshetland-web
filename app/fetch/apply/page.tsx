import { redirect } from "next/navigation";

// Fetch v1 address — applying to drive is /fetch/drive/apply in v2.
export default function OldApply() { redirect("/fetch/drive/apply"); }
