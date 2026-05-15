/**
 * Minimal top nav for receipt pages.
 *
 * Same fixed-top + backdrop-blur shape as adotob-store /partners,
 * but trimmed to: brand left, Partners + GitHub right.
 *
 * NO LinkedIn references. NO email anywhere.
 */

export function ReceiptNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#1e1e2e]">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="https://adotob.com"
          className="text-lg font-bold text-[#e8e8ed]"
        >
          Adotob<span className="text-[#6366f1]">.</span>
        </a>
        <div className="flex items-center gap-6 text-sm">
          <a
            href="https://estore.adotob.com/partners"
            className="text-[#8888a0] hover:text-[#22d3ee] transition-colors"
          >
            Partners
          </a>
          <a
            href="https://github.com/fabianwilliams/agentic-engineering-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8888a0] hover:text-[#22d3ee] transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
