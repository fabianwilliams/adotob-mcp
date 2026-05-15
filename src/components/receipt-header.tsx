/**
 * Receipt header — title block for the public /a2a/receipt/[id] page.
 *
 * Hard rule: never render the email. Only first_name, bundle, receipt id,
 * and timestamps are public. Email lives in the JSON server-side only.
 */

interface ReceiptHeaderProps {
  receiptId: string;
  firstName: string;
  bundle: string;
  createdAtIso: string;
  status: "success" | "failure";
}

const BUNDLE_LABELS: Record<string, string> = {
  "free-trial-sample": "Free-Trial Sample Bundle",
};

function formatTimestamp(iso: string): string {
  // "May 15, 2026 at 3:27 AM ET" — Intl.DateTimeFormat for consistency.
  try {
    const d = new Date(iso);
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
    const timePart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(d);
    // The Intl timeZoneName for America/New_York gives "EST" / "EDT". We want
    // something compact at the tail. Re-format to "May 15, 2026 at 3:27 AM ET".
    const compactTime = timePart
      .replace(" EST", " ET")
      .replace(" EDT", " ET");
    return `${datePart} at ${compactTime}`;
  } catch {
    return iso;
  }
}

export function ReceiptHeader({
  receiptId,
  firstName,
  bundle,
  createdAtIso,
  status,
}: ReceiptHeaderProps) {
  const bundleLabel = BUNDLE_LABELS[bundle] ?? bundle;
  const subtitle =
    status === "success"
      ? "Free-trial bundle requested via MCP."
      : "Free-trial bundle request did not complete.";

  return (
    <header className="mb-10">
      <p className="text-xs font-semibold uppercase tracking-[3px] text-[#8888a0] mb-3">
        Audit-Trail Receipt
      </p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#e8e8ed] mb-3 break-all">
        {receiptId}
      </h1>
      <p className="text-base text-[#8888a0] mb-6 leading-relaxed">{subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-[#8888a0] mb-1">
            Requested by
          </p>
          <p className="text-[#e8e8ed] font-medium">{firstName}</p>
        </div>
        <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-[#8888a0] mb-1">
            Bundle
          </p>
          <p className="text-[#e8e8ed] font-medium">{bundleLabel}</p>
        </div>
        <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-[#8888a0] mb-1">
            Issued
          </p>
          <p className="text-[#e8e8ed] font-medium">
            {formatTimestamp(createdAtIso)}
          </p>
        </div>
      </div>
    </header>
  );
}
