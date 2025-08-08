"use client";

import React, { forwardRef, useMemo } from "react";
import type { Plan, Placement } from "../types";
import { AspectRatio } from "./ui/aspect-ratio";
import clsx from "clsx";

export interface VisualizerProps {
  plan: Plan;
  className?: string;
}

function computeLabelFontSize(containerLength: number, containerWidth: number): number {
  const minDim = Math.min(containerLength, containerWidth);
  const size = minDim * 0.035; // ~3.5% of shorter side
  return Math.max(24, Math.min(size, 160));
}

function computeStrokeWidth(containerLength: number, containerWidth: number): number {
  const minDim = Math.min(containerLength, containerWidth);
  return Math.max(4, Math.min(minDim * 0.003, 20));
}

export const Visualizer = forwardRef<SVGSVGElement, VisualizerProps>(function Visualizer(
  { plan, className },
  ref
) {
  const { container, pallet, placements, constraints } = plan;

  const fontSize = useMemo(
    () => computeLabelFontSize(container.innerLength, container.innerWidth),
    [container.innerLength, container.innerWidth]
  );
  const strokeWidth = useMemo(
    () => computeStrokeWidth(container.innerLength, container.innerWidth),
    [container.innerLength, container.innerWidth]
  );

  // Legend data
  const palletDimsText = `${pallet.length}×${pallet.width} mm${pallet.height ? ` × ${pallet.height} mm` : ""}`;

  // Colors
  const containerStroke = "#334155"; // slate-700
  const palletFill = "#60a5fa"; // blue-400
  const palletFillRotated = "#3b82f6"; // blue-500
  const palletStroke = "#1e3a8a"; // blue-900

  const ratio = container.innerLength / container.innerWidth;

  return (
    <div className={clsx("w-full", className)}>
      <AspectRatio ratio={ratio}>
        <svg
          ref={ref}
          role="img"
          aria-label="Container layout visualizer"
          viewBox={`0 0 ${container.innerLength} ${container.innerWidth}`}
          className="h-full w-full"
        >
          {/* Container outline */}
          <rect
            x={0}
            y={0}
            width={container.innerLength}
            height={container.innerWidth}
            fill="#f8fafc" // slate-50
            stroke={containerStroke}
            strokeWidth={strokeWidth}
          />

          {/* Placements */}
          {placements.map((p: Placement) => (
            <g key={p.idx}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={p.rotated ? palletFillRotated : palletFill}
                stroke={palletStroke}
                strokeWidth={strokeWidth}
                rx={Math.max(0, strokeWidth * 1.5)}
                ry={Math.max(0, strokeWidth * 1.5)}
              />
              {/* Label */}
              <text
                x={p.x + p.w / 2}
                y={p.y + p.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a" // slate-900
                fontSize={fontSize}
                fontWeight={600}
              >
                {p.idx}
              </text>
            </g>
          ))}
        </svg>
      </AspectRatio>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-6 rounded-sm" style={{ backgroundColor: palletFill, outline: `1px solid ${palletStroke}` }} />
          <span>pallet {palletDimsText}</span>
        </div>
        {constraints.allowRotate && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm" style={{ backgroundColor: palletFillRotated, outline: `1px solid ${palletStroke}` }} />
            <span>rotated allowed</span>
          </div>
        )}
        <div className="text-slate-500">container {container.innerLength}×{container.innerWidth} mm{container.innerHeight ? ` × ${container.innerHeight} mm` : ""}</div>
      </div>
    </div>
  );
});

export default Visualizer;