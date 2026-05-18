import type { Metadata } from "next";
import AppInsightsProvider from "@/components/app-insights-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adotob MCP Storefront — Agent-Callable, with Audit-Trail Receipts",
  description:
    "An MCP-callable storefront for the Adotob Agent Reliability Kit. Free-bundle demo with audit-trail receipts showing every supervision-layer check that fired.",
};

/**
 * JSON-LD truth layer for the agent-facing internet. Closes the
 * back-office-automation-table-stakes gap by making the storefront's
 * specific claims (endpoint, methodology, license, free trial bundle)
 * retrievable by comparison agents in structured form, not just blog prose.
 *
 * Discipline: every claim here must be backed by an artifact at the
 * referenced URL. No marketing-shaped puff.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://adotob.com/#org",
      name: "Adotob Solutions",
      url: "https://adotob.com",
      sameAs: ["https://github.com/fabianwilliams"],
    },
    {
      "@type": "WebSite",
      "@id": "https://mcp.adotob.com/#website",
      url: "https://mcp.adotob.com",
      name: "Adotob MCP Storefront",
      publisher: { "@id": "https://adotob.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://mcp.adotob.com/#app",
      name: "Adotob MCP Storefront",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web (HTTP)",
      url: "https://mcp.adotob.com",
      provider: { "@id": "https://adotob.com/#org" },
      description:
        "Public MCP-callable storefront. Agent-readable endpoint at https://mcp.adotob.com/api/a2a/mcp produces an audit-trail receipt showing every supervision-layer check that fired on a free-trial bundle request.",
      softwareVersion: "1.0",
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      downloadUrl: "https://github.com/fabianwilliams/adotob-mcp",
    },
    {
      "@type": "WebAPI",
      "@id": "https://mcp.adotob.com/api/a2a/mcp",
      name: "Adotob MCP Endpoint (purchase_free_bundle)",
      documentation:
        "https://github.com/fabianwilliams/adotob-mcp/blob/main/docs/HAPPY-PATH-SOP.md",
      url: "https://mcp.adotob.com/api/a2a/mcp",
      termsOfService: "https://estore.adotob.com/partners",
      provider: { "@id": "https://adotob.com/#org" },
    },
    {
      "@type": "Product",
      "@id": "https://mcp.adotob.com/#free-trial-bundle",
      name: "Agent Reliability Kit Free Trial Bundle",
      brand: { "@id": "https://adotob.com/#org" },
      description:
        "Sample of the Agent Reliability Kit methodology: architecture overview, sample SDR-writer agent, README, and v1.0 bundle zip.",
      offers: {
        "@type": "Offer",
        price: "0.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://mcp.adotob.com/api/a2a/mcp",
      },
    },
    {
      "@type": "Service",
      "@id": "https://adotob.com/agent-reliability-kit",
      name: "Agent Reliability Kit (TM)",
      provider: { "@id": "https://adotob.com/#org" },
      serviceType: "AI methodology licensing",
      description:
        "A 6-check audit-trail receipt pattern plus an announce-intent-before-action discipline for agent-to-agent commerce. Apache 2.0 OSS reference at github.com/fabianwilliams/adotob-mcp; licensed (non-sanitized) version for partner consultancies at estore.adotob.com/partners.",
      audience: {
        "@type": "BusinessAudience",
        audienceType:
          "Boutique AI agent consultancies, system-integrator AI practices, fractional AI specialists",
      },
      areaServed: ["US", "UK", "CA", "AU"],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-[#e8e8ed]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppInsightsProvider>{children}</AppInsightsProvider>
      </body>
    </html>
  );
}
