"use client";

/**
 * Browser-side Application Insights init.
 *
 * Wraps the app body. Initializes the JS SDK once on mount with the
 * NEXT_PUBLIC_APPI_CONNECTION_STRING and turns on auto-pageview tracking.
 *
 * Hard rule: only metadata — never any user-typed first_name, email,
 * download token, or other secret. Custom events here log the receipt-page
 * route only.
 *
 * Wiring: the orchestrator wraps this around <body>'s {children} in
 * src/app/layout.tsx — this file does NOT edit layout.tsx (out of zone).
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  ApplicationInsights,
  type ITelemetryItem,
} from "@microsoft/applicationinsights-web";

interface Props {
  children: ReactNode;
}

export default function AppInsightsProvider({ children }: Props) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const connStr = process.env.NEXT_PUBLIC_APPI_CONNECTION_STRING;
    if (!connStr) return;

    try {
      const ai = new ApplicationInsights({
        config: {
          connectionString: connStr,
          enableAutoRouteTracking: true,
          disableFetchTracking: false,
          enableCorsCorrelation: false,
          disableExceptionTracking: false,
          // No cookie use — keeps the demo low-friction for cold visitors.
          isCookieUseDisabled: true,
        },
      });
      ai.loadAppInsights();

      // Redact: drop any incoming telemetry that smells like a query param
      // we shouldn't ship to App Insights (defensive). The receipt page
      // doesn't pass secrets in URLs by design, but defense in depth.
      ai.addTelemetryInitializer((item: ITelemetryItem) => {
        const url =
          (item.baseData && (item.baseData["uri"] as string | undefined)) ?? "";
        if (url && /token=|key=|secret=/i.test(url)) {
          return false;
        }
        return true;
      });

      ai.trackPageView();
    } catch {
      // never throw out of observability
    }
  }, []);

  return <>{children}</>;
}
