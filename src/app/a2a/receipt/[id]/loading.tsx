/**
 * Dark-themed loading skeleton for /a2a/receipt/[id].
 *
 * Rendered while the server component awaits the receipt JSON from Azure Blob.
 */

import { ReceiptNav } from "@/components/receipt-nav";

export default function ReceiptLoading() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed]">
      <ReceiptNav />
      <div className="pt-16">
        <div
          aria-busy="true"
          aria-live="polite"
          className="max-w-3xl mx-auto px-6 py-12 sm:py-16 space-y-10"
        >
          {/* Header skeleton */}
          <div>
            <div className="h-3 w-32 rounded bg-[#1e1e2e] mb-3 animate-pulse" />
            <div className="h-9 w-3/4 rounded bg-[#1e1e2e] mb-4 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[#1e1e2e] mb-6 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-16 rounded-lg border border-[#1e1e2e] bg-[#13131a] animate-pulse" />
              <div className="h-16 rounded-lg border border-[#1e1e2e] bg-[#13131a] animate-pulse" />
              <div className="h-16 rounded-lg border border-[#1e1e2e] bg-[#13131a] animate-pulse" />
            </div>
          </div>

          {/* CTA card skeleton */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-8 animate-pulse">
            <div className="h-3 w-40 rounded bg-[#1e1e2e] mb-3" />
            <div className="h-6 w-2/3 rounded bg-[#1e1e2e] mb-4" />
            <div className="h-4 w-full rounded bg-[#1e1e2e] mb-2" />
            <div className="h-4 w-5/6 rounded bg-[#1e1e2e] mb-6" />
            <div className="h-10 w-56 rounded bg-[#1e1e2e]" />
          </div>

          {/* Timeline skeleton */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-8">
            <div className="h-3 w-48 rounded bg-[#1e1e2e] mb-2 animate-pulse" />
            <div className="h-6 w-2/3 rounded bg-[#1e1e2e] mb-6 animate-pulse" />
            <div className="space-y-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#1e1e2e] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-1/3 rounded bg-[#1e1e2e] mb-2 animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-[#1e1e2e] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
