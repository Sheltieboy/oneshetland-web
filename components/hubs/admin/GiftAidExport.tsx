"use client";

type Donation = Record<string, unknown>;

function field(d: Donation, k: string): string {
  const v = d[k];
  return v == null ? "" : String(v);
}

export function GiftAidExport({ donations, hubName }: { donations: Donation[]; hubName: string }) {
  function download() {
    const headers = ["Title", "First name", "Last name", "Address", "Postcode", "Amount (£)", "Date"];
    const rows = donations.map((d) => [
      field(d, "ga_title"),
      field(d, "ga_first_name"),
      field(d, "ga_last_name"),
      field(d, "ga_address"),
      field(d, "ga_postcode"),
      (Number(d["amount_pence"] ?? 0) / 100).toFixed(2),
      field(d, "created_at").slice(0, 10),
    ]);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hubName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-gift-aid.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = donations.reduce((sum, d) => sum + Number(d["amount_pence"] ?? 0), 0);

  if (donations.length === 0) {
    return <p className="rounded-xl border border-line bg-paper p-6 text-ink-soft shadow-soft">No Gift Aid declarations yet. They&apos;ll appear here as donors opt in.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <div>
          <p className="font-display text-2xl font-bold">{donations.length} declaration{donations.length === 1 ? "" : "s"}</p>
          <p className="text-sm text-ink-muted">£{(total / 100).toFixed(2)} eligible · est. £{((total * 0.25) / 100).toFixed(2)} Gift Aid</p>
        </div>
        <button onClick={download} className="rounded-pill bg-navy px-5 py-2.5 font-semibold text-paper transition hover:bg-navy-dark">
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-ink-muted">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Postcode</th><th className="p-3">Amount</th><th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="p-3 font-medium text-ink">{field(d, "ga_first_name")} {field(d, "ga_last_name")}</td>
                <td className="p-3 text-ink-soft">{field(d, "ga_postcode")}</td>
                <td className="p-3 text-ink-soft">£{(Number(d["amount_pence"] ?? 0) / 100).toFixed(2)}</td>
                <td className="p-3 text-ink-soft">{field(d, "created_at").slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
