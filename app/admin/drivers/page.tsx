import { redirect } from "next/navigation";

/** The old one-click approval screen wrote driver_status straight to the table, which the database now refuses (Fetch v2 Step 6).
 *  Driver review lives in Fetch operations, where approval needs every required document accepted. */
export default function Page() {
  redirect("/admin/fetch/drivers");
}
