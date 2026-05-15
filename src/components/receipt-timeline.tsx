/**
 * Receipt timeline — vertical sequence of the 6 audit-trail checks.
 *
 * Color rules per shared context:
 *   pass = green (#22c55e) check
 *   fail = red (#ef4444) x
 *   skip = subtext (#8888a0) dash
 *   warn = orange-yellow check
 */

type CheckStatus = "pass" | "fail" | "warn" | "skip";

interface AuditCheck {
  id: string;
  name: string;
  status: CheckStatus;
  at_iso: string;
  details: string;
}

interface ReceiptTimelineProps {
  checks: AuditCheck[];
}

function formatCheckTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "pass") {
    return (
      <span
        aria-label="Pass"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-base font-bold border border-[#22c55e]/30"
      >
        &#10003;
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span
        aria-label="Fail"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#ef4444]/15 text-[#ef4444] text-base font-bold border border-[#ef4444]/30"
      >
        &#10007;
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span
        aria-label="Warning"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] text-base font-bold border border-[#f59e0b]/30"
      >
        &#10003;
      </span>
    );
  }
  return (
    <span
      aria-label="Skipped"
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1e1e2e] text-[#8888a0] text-base font-bold border border-[#1e1e2e]"
    >
      &mdash;
    </span>
  );
}

function StatusLabel({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { text: string; cls: string }> = {
    pass: { text: "PASS", cls: "text-[#22c55e]" },
    fail: { text: "FAIL", cls: "text-[#ef4444]" },
    warn: { text: "WARN", cls: "text-[#f59e0b]" },
    skip: { text: "SKIP", cls: "text-[#8888a0]" },
  };
  const entry = map[status];
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider ${entry.cls}`}
    >
      {entry.text}
    </span>
  );
}

export function ReceiptTimeline({ checks }: ReceiptTimelineProps) {
  return (
    <section
      aria-label="Supervision-layer audit trail"
      className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-6 sm:p-8"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[3px] text-[#6366f1] mb-2">
          Supervision-layer audit trail
        </p>
        <h2 className="text-xl font-bold text-[#e8e8ed]">
          Every check that fired, in order.
        </h2>
      </div>
      <ol className="space-y-0">
        {checks.map((check, idx) => {
          const isLast = idx === checks.length - 1;
          return (
            <li key={check.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[13px] top-8 bottom-0 w-px bg-[#1e1e2e]"
                />
              )}
              <div className="relative z-10 flex-shrink-0 pt-0.5">
                <StatusBadge status={check.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-base font-semibold text-[#e8e8ed]">
                    {check.name}
                  </h3>
                  <StatusLabel status={check.status} />
                </div>
                <p className="text-sm text-[#8888a0] leading-relaxed mb-1">
                  {check.details}
                </p>
                <p className="text-xs text-[#8888a0]/70 font-mono">
                  {formatCheckTime(check.at_iso)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
