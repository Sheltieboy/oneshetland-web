/** Reporting periods for the fee reports. Pure. */
export const RANGES = [{ key: "30", days: 30, label: "30 days" }, { key: "90", days: 90, label: "90 days" }, { key: "365", days: 365, label: "12 months" }] as const;
export const rangeDays = (v: string | undefined): number => RANGES.find((r) => r.key === v)?.days ?? 90;
/** The reporting window ending tomorrow (so today is included). */
export const rangeWindow = (days: number, now: number = Date.now()) => ({ from: new Date(now - days * 864e5).toISOString(), to: new Date(now + 864e5).toISOString() });
