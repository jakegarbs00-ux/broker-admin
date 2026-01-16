"use client";

import { useEffect } from "react";

export function ReactiveBackground() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      document.documentElement.style.setProperty("--cursor-x", "50%");
      document.documentElement.style.setProperty("--cursor-y", "50%");
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--cursor-x", `${x}%`);
      document.documentElement.style.setProperty("--cursor-y", `${y}%`);
    };

    let ticking = false;
    const throttledMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleMouseMove(e);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("mousemove", throttledMove, { passive: true });
    document.documentElement.style.setProperty("--cursor-x", "50%");
    document.documentElement.style.setProperty("--cursor-y", "50%");

    return () => {
      window.removeEventListener("mousemove", throttledMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden="true">
      {/* Base background */}
      <div className="absolute inset-0 bg-[var(--color-bg-primary)]" />
      {/* Cursor-reactive gradient */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle 600px at var(--cursor-x, 50%) var(--cursor-y, 50%), rgba(59, 130, 246, 0.15), transparent 70%)`,
        }}
      />
      {/* Subtle grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}

