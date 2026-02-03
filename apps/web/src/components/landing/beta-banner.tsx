"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

export function BetaBanner(): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-[#7C3AED] text-white px-4 py-2.5 text-center text-sm">
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          <strong>Early Access</strong> — All features are free during beta.{" "}
          <Link href="/register" className="underline underline-offset-2 hover:opacity-80">
            Create your account
          </Link>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
