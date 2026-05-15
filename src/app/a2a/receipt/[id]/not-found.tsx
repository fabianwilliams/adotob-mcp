/**
 * 404 for /a2a/receipt/[id] — receipt expired or never existed.
 */

import Link from "next/link";

import { ReceiptNav } from "@/components/receipt-nav";

export default function ReceiptNotFound() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed]">
      <ReceiptNav />
      <div className="pt-16">
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[3px] text-[#8888a0] mb-4">
            404 &mdash; Receipt unavailable
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#e8e8ed] mb-4">
            This receipt is no longer available.
          </h1>
          <p className="text-base text-[#8888a0] leading-relaxed mb-8">
            Receipt URLs expire after 30 days. After expiry the audit-trail JSON
            is removed from the receipt store. If you still need a copy, request
            a fresh bundle through the MCP endpoint and a new receipt will be
            issued.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/"
              className="bg-[#6366f1] hover:bg-[#5254e0] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            >
              Back to the storefront
            </Link>
            <a
              href="https://github.com/fabianwilliams/agentic-engineering-toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#1e1e2e] hover:border-[#6366f1] hover:text-[#6366f1] text-[#e8e8ed] px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            >
              About the methodology
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
