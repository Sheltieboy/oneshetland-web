import { redirect } from "next/navigation";

/** The old "create an organiser" address. Editions now start from a Business or Hub, so old links go to the Editions home. */
export default function NewOrganiserRedirect(): never {
  redirect("/organise");
}
