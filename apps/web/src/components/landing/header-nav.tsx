"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-provider";
import { Logo } from "@/components/logo";
import { BetaBanner } from "./beta-banner";

export function HeaderNav(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Defer auth-dependent rendering until after hydration.
  // The page is force-static (built without a session), so the server HTML always
  // shows "Get Started". Without hasMounted, better-auth's useSession() could
  // resolve from cookies synchronously on the client, causing a hydration mismatch.
  // Using rAF callback (not direct setState) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const showDashboard = hasMounted && !isLoading && isAuthenticated;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {!bannerDismissed && <BetaBanner />}
      <div className="bg-white/90 backdrop-blur-sm border-b border-black/10">
        <nav className="mx-auto max-w-332.5 border-x border-black/10 px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              Pricing
            </a>
            <a
              href="#compliance"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              Compliance
            </a>
            <a
              href="https://github.com/agentgov-co/agentgov"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              GitHub
            </a>
            <a
              href="mailto:omadillo@agentgov.co"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              Support
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className={`hidden sm:block text-sm text-black/60 hover:text-black transition-colors ${
                showDashboard ? "invisible" : ""
              }`}
              tabIndex={showDashboard ? -1 : undefined}
              aria-hidden={showDashboard || undefined}
            >
              Log in
            </Link>
            <Link
              href={showDashboard ? "/dashboard" : "/register"}
              className="min-w-[100px] text-center px-3 sm:px-4 py-2 bg-[#7C3AED] text-white rounded-lg text-sm font-medium hover:bg-[#7C3AED]/90 transition-colors"
            >
              {showDashboard ? "Dashboard" : "Get Started"}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
