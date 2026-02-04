"use client";

import { useCallback } from "react";

export function SkipLink(): React.JSX.Element {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main =
      document.getElementById("main-content") ?? document.querySelector("main");
    if (!main) return;

    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
      main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
        once: true,
      });
    }

    main.focus();
    main.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-100 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground focus-visible:text-sm focus-visible:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
