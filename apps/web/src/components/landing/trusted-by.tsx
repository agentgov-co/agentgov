"use client";

import React, { useEffect, useRef, useState } from "react";

interface Logo {
  name: string;
  text: string;
}

interface TrustedByProps {
  logos: Logo[];
  title?: string;
}

export function TrustedBy({ logos, title = "Trusted by" }: TrustedByProps): React.JSX.Element {
  const shouldScroll = logos.length > 5;
  const [isHovered, setIsHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Auto-scroll effect for more than 5 logos
  useEffect(() => {
    if (!shouldScroll || isHovered) return;

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    const speed = 0.5; // pixels per frame

    const scroll = (): void => {
      scrollPositionRef.current += speed;

      // Reset when we've scrolled through half (since we duplicate the logos)
      const halfWidth = scrollContainer.scrollWidth / 2;
      if (scrollPositionRef.current >= halfWidth) {
        scrollPositionRef.current = 0;
      }

      scrollContainer.scrollLeft = scrollPositionRef.current;
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [shouldScroll, isHovered]);

  // Static grid for 5 or fewer logos
  if (!shouldScroll) {
    return (
      <div>
        <div className="px-6 py-4 border-b border-black/10">
          <span className="text-xs text-black/40 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:flex">
          {logos.map((logo, i) => (
            <div
              key={logo.name}
              className={`flex-1 flex items-center justify-center h-16 sm:h-20 md:h-24 border-black/10 ${
                i % 2 === 0 ? "border-r sm:border-r" : "sm:border-r"
              } ${i < logos.length - 2 ? "border-b sm:border-b-0" : ""} ${
                i === logos.length - 1 ? "sm:border-r-0" : ""
              }`}
            >
              <span className="text-base sm:text-lg md:text-xl font-medium text-black/30">
                {logo.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Scrolling carousel for more than 5 logos
  const duplicatedLogos = [...logos, ...logos]; // Duplicate for seamless loop

  return (
    <div>
      <div className="px-6 py-4 border-b border-black/10">
        <span className="text-xs text-black/40 uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex">
          {duplicatedLogos.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex-shrink-0 flex items-center justify-center h-20 md:h-24 w-[200px] md:w-[250px] border-r border-black/10"
            >
              <span className="text-lg md:text-xl font-medium text-black/30">
                {logo.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
