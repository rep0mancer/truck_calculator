"use client";

import React from "react";
import clsx from "clsx";

export interface TruckDecorProps {
  className?: string;
}

// Purely decorative truck to indicate front (cab) and back (trailer)
export function TruckDecor({ className }: TruckDecorProps) {
  return (
    <div className={clsx("w-full flex items-center justify-center select-none", className)} aria-hidden>
      <svg
        viewBox="0 0 600 180"
        role="presentation"
        className="w-[min(720px,100%)] h-auto drop-shadow-sm"
      >
        {/* Ground shadow */}
        <ellipse cx="300" cy="155" rx="260" ry="12" fill="#e5e7eb" />

        {/* Trailer (back) */}
        <rect x="220" y="40" width="330" height="80" rx="8" fill="#e2e8f0" stroke="#94a3b8" />
        <rect x="220" y="40" width="330" height="80" rx="8" fill="url(#trailerGrad)" opacity="0.35" />

        {/* Cab (front) */}
        <g>
          <rect x="80" y="70" width="120" height="50" rx="8" fill="#bfdbfe" stroke="#60a5fa" />
          <path d="M80 70 L130 40 L180 40 L200 70 Z" fill="#93c5fd" stroke="#60a5fa" />
          {/* Window */}
          <path d="M132 52 L172 52 L188 70 L120 70 Z" fill="#e0f2fe" stroke="#60a5fa" />
        </g>

        {/* Drawbar / connector */}
        <rect x="200" y="92" width="20" height="6" rx="3" fill="#94a3b8" />

        {/* Wheels */}
        <g>
          <circle cx="150" cy="130" r="16" fill="#111827" />
          <circle cx="150" cy="130" r="7" fill="#9ca3af" />

          <circle cx="300" cy="130" r="16" fill="#111827" />
          <circle cx="300" cy="130" r="7" fill="#9ca3af" />

          <circle cx="360" cy="130" r="16" fill="#111827" />
          <circle cx="360" cy="130" r="7" fill="#9ca3af" />
        </g>

        {/* Front/Back labels */}
        <g fontFamily="ui-sans-serif,system-ui" fontSize="16" fontWeight="700" fill="#334155">
          <text x="110" y="28" textAnchor="middle">Front</text>
          <text x="385" y="135" textAnchor="middle" fill="#475569">Back →</text>
        </g>

        <defs>
          <linearGradient id="trailerGrad" x1="220" y1="40" x2="550" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default TruckDecor;

