"use client";

import { cn } from "@/lib/utils";
import React, { CSSProperties } from "react";

interface BorderBeamProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  children,
  className,
  duration = 8,
  colorFrom = "#7C3AED",
  colorTo = "#8b5cf6",
}: BorderBeamProps): React.JSX.Element {
  return (
    <div
      className={cn("border-beam", className)}
      style={
        {
          "--border-beam-color-from": colorFrom,
          "--border-beam-color-to": colorTo,
          "--border-beam-duration": `${duration}s`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
