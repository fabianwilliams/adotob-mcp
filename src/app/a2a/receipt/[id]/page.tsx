/**
 * Public receipt page — /a2a/receipt/[id]
 *
 * Server component. Reads JSON from Azure Blob via loadReceipt().
 * Renders dark-themed audit-trail page with all 6 checks.
 *
 * Hard rules:
 *   - NEVER render the email. Server reads it but it does not enter the HTML.
 *   - On failure receipts, the audit trail still renders — it IS the demo.
 *   - No LinkedIn references anywhere.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadReceipt } from "@/lib/receipt-store";
import { ReceiptHeader } from "@/components/receipt-header";
import { ReceiptNav } from "@/components/receipt-nav";
import { ReceiptShare } from "@/components/receipt-share";
import { ReceiptTimeline } from "@/components/receipt-timeline";

type CheckStatus = "pass" | "fail" | "warn" | "skip";

interface AuditCheck {
  id: string;
  name: string;
  status: CheckStatus;
  at_iso: string;
  details: string;
}

interface ReceiptJson {
  receipt_id: string;
  created_at_iso: string;
  request: {
    first_name: string;
    bundle: string;
    source: "mcp" | "raw_http";
    user_agent_partial: string;
  };
  checks: AuditCheck[];
  result: {
    status: "success" | "failure";
    download_url?: string;
    shareable_receipt_url: string;
  };
}

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

// Receipt URLs expire after 30 days at the blob level. The HTML itself is
// not aggressively cached so updates to the receipt JSON propagate quickly.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ReceiptPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Receipt ${id} — Adotob MCP Storefront`,
    description:
      "Audit-trail receipt for an MCP-callable bundle request. Shows every supervision-layer check that fired during the transaction.",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;

  let receipt: ReceiptJson | null = null;
  try {
    receipt = await loadReceipt<ReceiptJson>(id);
  } catch {
    // Fall through to notFound() — never expose backend error detail in the
    // HTML. App Insights captures the underlying failure server-side.
    receipt = null;
  }

  if (!receipt) {
    notFound();
  }

  const status = receipt.result?.status ?? "failure";
  const isSuccess = status === "success";
  const firstName = receipt.request?.first_name ?? "there";
  const bundle = receipt.request?.bundle ?? "free-trial-sample";
  const downloadUrl = receipt.result?.download_url;
  const shareUrl =
    receipt.result?.shareable_receipt_url ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcp.adotob.com"}/a2a/receipt/${id}`;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed]">
      <ReceiptNav />

      <div className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16 space-y-10">
          <ReceiptHeader
            receiptId={receipt.receipt_id}
            firstName={firstName}
            bundle={bundle}
            createdAtIso={receipt.created_at_iso}
            status={status}
          />

          {isSuccess && downloadUrl ? (
            <section
              aria-label="Download bundle"
              className="rounded-xl border-2 border-[#6366f1] bg-[#13131a] p-6 sm:p-8 shadow-[0_8px_32px_rgba(99,102,241,0.15)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[3px] text-[#6366f1] mb-2">
                Your bundle is ready
              </p>
              <h2 className="text-xl font-bold text-[#e8e8ed] mb-3">
                Download the free-trial bundle.
              </h2>
              <p className="text-sm text-[#8888a0] leading-relaxed mb-6">
                The download link is signed and expires in 24 hours. A copy was
                also dispatched as a transactional email so you can come back to
                it.
              </p>
              <a
                href={downloadUrl}
                className="inline-block bg-[#6366f1] hover:bg-[#5254e0] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                Download your free-trial bundle &rarr;
              </a>
            </section>
          ) : (
            <section
              aria-label="Purchase did not complete"
              className="rounded-xl border-2 border-[#ef4444] bg-[#13131a] p-6 sm:p-8 shadow-[0_8px_32px_rgba(239,68,68,0.15)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[3px] text-[#ef4444] mb-2">
                Purchase did not complete
              </p>
              <h2 className="text-xl font-bold text-[#e8e8ed] mb-3">
                One or more supervision-layer checks failed.
              </h2>
              <p className="text-sm text-[#8888a0] leading-relaxed mb-6">
                That is the point of the audit trail below &mdash; you can see
                exactly which check fired and why. The receipt is shareable as
                proof of the failure path. Try again from the MCP endpoint when
                you are ready.
              </p>
              <Link
                href="/"
                className="inline-block border border-[#1e1e2e] hover:border-[#6366f1] hover:text-[#6366f1] text-[#e8e8ed] px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                Try again via the MCP endpoint &rarr;
              </Link>
            </section>
          )}

          <ReceiptTimeline checks={receipt.checks ?? []} />

          <ReceiptShare receiptUrl={shareUrl} receiptId={receipt.receipt_id} />

          <footer className="text-center pt-6">
            <p className="text-xs text-[#8888a0]/70 italic leading-relaxed max-w-xl mx-auto">
              Receipt URLs expire after 30 days. Audit-trail format described at{" "}
              <a
                href="https://github.com/fabianwilliams/agentic-engineering-toolkit"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#22d3ee]"
              >
                the Agentic Engineering Toolkit
              </a>
              .
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
