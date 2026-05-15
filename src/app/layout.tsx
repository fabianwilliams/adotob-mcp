import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adotob MCP Storefront — Agent-Callable, with Audit-Trail Receipts",
  description:
    "An MCP-callable storefront for the Adotob Agent Reliability Kit. Free-bundle demo with audit-trail receipts showing every supervision-layer check that fired.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-[#e8e8ed]">{children}</body>
    </html>
  );
}
