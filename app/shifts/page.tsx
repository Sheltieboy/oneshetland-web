import { redirect } from "next/navigation";

export default function ShiftsIndex() {
  redirect("/jobs?tab=shifts");
}
