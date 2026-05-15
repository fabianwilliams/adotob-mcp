"use client";

/**
 * Receipt share — copy-link affordance + share-to-X (Twitter) intent.
 *
 * Client component. Buttons use the site palette. No email is referenced.
 */

import { useState } from "react";

interface ReceiptShareProps {
  receiptUrl: string;
  receiptId: string;
}

export function ReceiptShare({ receiptUrl, receiptId }: ReceiptShareProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(receiptUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard API unavailable — silently no-op. User can still copy the
      // URL from the address bar.
    }
  };

  const tweetText = `Audit-trail receipt for an MCP-callable purchase: ${receiptId}. Every supervision-layer check that fired, in order.`;
  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(receiptUrl)}`;

  return (
    <section
      aria-label="Share this receipt"
      className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-6 sm:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[3px] text-[#6366f1] mb-2">
        Share
      </p>
      <h2 className="text-xl font-bold text-[#e8e8ed] mb-4">
        This receipt is public for 30 days.
      </h2>
      <p className="text-sm text-[#8888a0] leading-relaxed mb-6">
        The receipt URL is the audit trail. Share it with peers, link it from a
        post, or paste it into a procurement thread. No email is exposed.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCopy}
          className="border border-[#1e1e2e] hover:border-[#6366f1] hover:text-[#6366f1] text-[#e8e8ed] px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
        >
          {copied ? "Copied" : "Copy receipt link"}
        </button>
        <a
          href={tweetIntent}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[#1e1e2e] hover:border-[#22d3ee] hover:text-[#22d3ee] text-[#e8e8ed] px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
        >
          Share on X
        </a>
      </div>
    </section>
  );
}
