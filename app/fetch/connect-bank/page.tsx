import { redirect } from "next/navigation";

// Bank/payout setup is now centralised on the profile (shared by every section),
// so the Fetch-specific page just forwards to the account payments area.
export default function FetchConnectBankRedirect() {
  redirect("/account/payments");
}
