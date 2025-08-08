"use client";

import React from "react";
import type { Plan } from "../types";
import { Badge } from "./ui/badge";

export interface MetricsPanelProps {
  plan: Plan | null;
}

export default function MetricsPanel({ plan }: MetricsPanelProps) {
  if (!plan) {
    return (
      <p className="mt-3 text-sm text-slate-600">No plan computed yet. Adjust inputs and click "Compute plan".</p>
    );
  }

  const { metrics } = plan;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
      <div className="rounded-md border p-3">
        <div className="text-slate-500">Total pallets</div>
        <div className="text-base font-semibold">{metrics.count}</div>
      </div>
      <div className="rounded-md border p-3">
        <div className="text-slate-500">Floor area used</div>
        <div className="text-base font-semibold">{(metrics.floorAreaUsedRatio * 100).toFixed(1)}%</div>
      </div>
      {metrics.volumeUsedRatio != null && (
        <div className="rounded-md border p-3">
          <div className="text-slate-500">Volume used</div>
          <div className="text-base font-semibold">{(metrics.volumeUsedRatio * 100).toFixed(1)}%</div>
        </div>
      )}
      {metrics.totalPalletWeightKg != null && (
        <div className="rounded-md border p-3">
          <div className="text-slate-500">Total est. weight</div>
          <div className="text-base font-semibold">{metrics.totalPalletWeightKg.toFixed(0)} kg</div>
        </div>
      )}
      {metrics.maxPayloadExceeded && (
        <div className="col-span-2 md:col-span-1 flex items-center justify-start">
          <Badge variant="destructive">Payload exceeds max</Badge>
        </div>
      )}
    </div>
  );
}