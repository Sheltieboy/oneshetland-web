import { redirect } from "next/navigation";

// Fetch v1 explainer — the v2 landing page carries "how it works".
export default function OldAbout() { redirect("/fetch"); }
