import { publicClient } from "./supabase/public";

/**
 * Is Fetch open for real use? Reads the database switch (admin_config fetch.operations via the fail-closed RPC fetch_is_open()).
 * ANY error, timeout or unexpected answer means PAUSED. This only decides what the website SHOWS: the database itself refuses requests,
 * acceptances, runs, applications and approvals while paused, so the page can never be the only safeguard.
 */
export async function fetchIsOpen(): Promise<boolean> {
  try {
    const { data, error } = await publicClient().rpc("fetch_is_open");
    return !error && data === true;
  } catch { return false; }
}
