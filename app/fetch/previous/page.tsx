import { redirect } from "next/navigation";

// Fetch v1 address — history is /fetch/history in v2.
export default function OldPrevious() { redirect("/fetch/history"); }
