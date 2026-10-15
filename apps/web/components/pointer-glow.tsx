"use client";

import { useEffect } from "react";

const glowSelector = "button, a.primary-button, a.secondary-button, a.text-button, .media-card";

/** Shares one pointer listener across the page and writes local coordinates as CSS variables. */
export function PointerGlow(): null {
  useEffect(() => {
    const moveGlow = (event: PointerEvent): void => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(glowSelector);
      if (!target) return;
      const bounds = target.getBoundingClientRect();
      target.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
      target.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
    };
    document.addEventListener("pointermove", moveGlow, { passive: true });
    return () => document.removeEventListener("pointermove", moveGlow);
  }, []);

  return null;
}
