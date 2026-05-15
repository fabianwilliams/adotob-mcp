/**
 * Receipt timeline — vertical sequence of the audit-trail checks, bucketed into
 * three methodology phases: Admission, Processing, Fulfillment.
 *
 * Color rules per shared context:
 *   pass = green (#22c55e) check
 *   fail = red (#ef4444) x
 *   skip = subtext (#8888a0) dash
 *   warn = orange-yellow check
 *
 * Phase mapping is keyed by check.id so the canonical receipt JSON shape stays
 * unchanged on the wire — the bucketing is a UI-level projection.
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

type PhaseKey = "admission" | "processing" | "fulfillment";

interface PhaseDef {
  key: PhaseKey;
  label: string;
  subtitle: string;
  accent: string;
  checkIds: string[];
}

const PHASES: PhaseDef[] = [
  {
    key: "admission",
    label: "1 · Admission gates",
    subtitle: "Should this request even proceed?",
    accent: "#22d3ee",
    checkIds: ["input_validation", "rate_limit", "cost_ceiling"],
  },
  {
    key: "processing",
    label: "2 · Processing",
    subtitle: "Capture the lead, sign the entitlement.",
    accent: "#6366f1",
    checkIds: ["brevo_contact_upsert", "download_token_mint"],
  },
  {
    key: "fulfillment",
    label: "3 · Fulfillment",
    subtitle: "Deliver the goods to the customer.",
    accent: "#22c55e",
    checkIds: ["fulfillment_dispatch"],
  },
];

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

function CheckRow({
  check,
  isLastInPhase,
}: {
  check: AuditCheck;
  isLastInPhase: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!isLastInPhase && (
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
}

export function ReceiptTimeline({ checks }: ReceiptTimelineProps) {
  const checksById = new Map(checks.map((c) => [c.id, c]));
  const knownIds = new Set(PHASES.flatMap((p) => p.checkIds));
  const orphanChecks = checks.filter((c) => !knownIds.has(c.id));

  return (
    <section
      aria-label="Supervision-layer audit trail"
      className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-6 sm:p-8"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[3px] text-[#6366f1] mb-2">
          Supervision-layer audit trail
        </p>
        <h2 className="text-xl font-bold text-[#e8e8ed]">
          Every check that fired, in order.
        </h2>
        <p className="text-sm text-[#8888a0] mt-2 leading-relaxed">
          Bucketed into three methodology phases &mdash; admission, processing, fulfillment.
        </p>
      </div>

      <div className="space-y-8">
        {PHASES.map((phase) => {
          const phaseChecks = phase.checkIds
            .map((id) => checksById.get(id))
            .filter((c): c is AuditCheck => c !== undefined);

          if (phaseChecks.length === 0) {
            return null;
          }

          return (
            <div key={phase.key}>
              <div
                className="border-l-2 pl-4 mb-4"
                style={{ borderColor: phase.accent }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[2px] mb-1"
                  style={{ color: phase.accent }}
                >
                  {phase.label}
                </p>
                <p className="text-sm text-[#8888a0] italic">
                  {phase.subtitle}
                </p>
              </div>
              <ol className="space-y-0">
                {phaseChecks.map((check, idx) => (
                  <CheckRow
                    key={check.id}
                    check={check}
                    isLastInPhase={idx === phaseChecks.length - 1}
                  />
                ))}
              </ol>
            </div>
          );
        })}

        {orphanChecks.length > 0 && (
          <div>
            <div className="border-l-2 border-[#8888a0] pl-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-[2px] mb-1 text-[#8888a0]">
                Other checks
              </p>
              <p className="text-sm text-[#8888a0] italic">
                Checks not yet assigned to a phase.
              </p>
            </div>
            <ol className="space-y-0">
              {orphanChecks.map((check, idx) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  isLastInPhase={idx === orphanChecks.length - 1}
                />
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
