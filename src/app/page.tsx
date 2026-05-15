import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adotob MCP Storefront",
  description:
    "Agent-callable storefront for the Adotob Agent Reliability Kit. MCP server with audit-trail receipts.",
};

export default function HomePage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[3px] text-[#8888a0] mb-6">
          From Adotob Solutions
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-[#6366f1] to-[#22d3ee] bg-clip-text text-transparent">
          MCP-Callable Storefront
        </h1>
        <p className="text-lg text-[#8888a0] mb-10 leading-relaxed">
          An agent-callable storefront for the Adotob Agent Reliability Kit. Connect
          your Claude or ChatGPT to{" "}
          <code className="text-[#22d3ee] bg-[#1e1e2e] px-2 py-0.5 rounded text-base">
            https://mcp.adotob.com/api/a2a/mcp
          </code>{" "}
          and request the free-trial bundle. You get back an audit-trail receipt showing
          every supervision-layer check that fired during the purchase.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="https://estore.adotob.com/partners"
            className="inline-block bg-[#6366f1] hover:bg-[#5254e0] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
          >
            About the methodology &rarr;
          </a>
          <a
            href="https://github.com/fabianwilliams/agentic-engineering-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-[#1e1e2e] hover:border-[#6366f1] hover:text-[#6366f1] text-[#e8e8ed] px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
          >
            Public Kit on GitHub
          </a>
        </div>
        <p className="text-xs text-[#8888a0]/60 mt-12 italic">
          This surface is by invitation. The MCP endpoint is rate-limited. Receipt URLs expire after 30 days.
        </p>
      </div>
    </main>
  );
}
