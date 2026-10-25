import { redirect } from "next/navigation";

// Fetch v1 address — "runs" are journeys in v2.
export default function OldNewRun() { redirect("/fetch/journeys/new"); }
