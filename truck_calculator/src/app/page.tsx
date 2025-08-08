"use client";

import React, { useMemo } from "react";
import { usePlannerStore } from "../store";
import { CONTAINER_PRESETS, PALLET_PRESETS } from "../presets";
import type { ContainerPreset, PalletPreset, Units, Constraints } from "../types";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
 import { Separator } from "../components/ui/separator";
 import Visualizer from "../components/Visualizer";
 import MetricsPanel from "../components/MetricsPanel";
 
function mmToDisplay(mm: number | undefined, units: Units): string {
  if (mm == null || Number.isNaN(mm)) return "";
  if (units === "imperial") return (mm / 25.4).toFixed(1);
  return Math.round(mm).toString();
}

function displayToMm(v: string, units: Units): number {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  if (units === "imperial") return Math.round(n * 25.4);
  return Math.round(n);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold tracking-tight text-slate-800">{children}</h2>
  );
}

export default function PlannerPage() {
  const {
    // state
    units,
    containerId,
    containerCustom,
    palletId,
    palletCustom,
    constraints,
    plan,
    lastValidationErrors,
    // actions
    setUnits,
    setContainerById,
    setCustomContainer,
    setPalletById,
    setCustomPallet,
    setConstraints,
    recompute,
    reset,
  } = usePlannerStore();

  const unitSuffix = units === "metric" ? "mm" : "in";

  const selectedContainer: ContainerPreset = useMemo(() => {
    if (containerId === "custom" && containerCustom) return containerCustom as ContainerPreset;
    return CONTAINER_PRESETS.find((c) => c.id === containerId) ?? CONTAINER_PRESETS[0];
  }, [containerCustom, containerId]);

  const selectedPallet: PalletPreset = useMemo(() => {
    if (palletId === "custom" && palletCustom) return palletCustom as PalletPreset;
    return PALLET_PRESETS.find((p) => p.id === palletId) ?? PALLET_PRESETS[0];
  }, [palletCustom, palletId]);

  const onContainerPresetChange = (value: string) => {
    if (value === "custom") {
      const base: ContainerPreset = {
        id: "custom",
        name: containerCustom?.name || "Custom container",
        innerLength: containerCustom?.innerLength ?? 6000,
        innerWidth: containerCustom?.innerWidth ?? 2400,
        innerHeight: containerCustom?.innerHeight,
        maxPayloadKg: containerCustom?.maxPayloadKg,
      };
      setCustomContainer(base as any);
    } else {
      setContainerById(value);
    }
  };

  const onPalletPresetChange = (value: string) => {
    if (value === "custom") {
      const base: PalletPreset = {
        id: "custom",
        name: palletCustom?.name || "Custom pallet",
        length: palletCustom?.length ?? 1200,
        width: palletCustom?.width ?? 800,
        height: palletCustom?.height,
        weightKg: palletCustom?.weightKg,
      };
      setCustomPallet(base as any);
    } else {
      setPalletById(value);
    }
  };

  const updateContainerField = (field: keyof ContainerPreset, value: string) => {
    const next: ContainerPreset = {
      id: "custom",
      name: containerCustom?.name || "Custom container",
      innerLength: containerCustom?.innerLength ?? selectedContainer.innerLength,
      innerWidth: containerCustom?.innerWidth ?? selectedContainer.innerWidth,
      innerHeight: containerCustom?.innerHeight,
      maxPayloadKg: containerCustom?.maxPayloadKg,
    } as ContainerPreset;

    if (field === "name") {
      (next as any).name = value || "Custom container";
    } else if (field === "maxPayloadKg") {
      (next as any).maxPayloadKg = parseFloat(value) || undefined;
    } else if (field === "innerHeight") {
      (next as any).innerHeight = value === "" ? undefined : displayToMm(value, units);
    } else if (field === "innerLength") {
      (next as any).innerLength = displayToMm(value, units);
    } else if (field === "innerWidth") {
      (next as any).innerWidth = displayToMm(value, units);
    }

    setCustomContainer(next as any);
  };

  const updatePalletField = (field: keyof PalletPreset, value: string) => {
    const next: PalletPreset = {
      id: "custom",
      name: palletCustom?.name || "Custom pallet",
      length: palletCustom?.length ?? selectedPallet.length,
      width: palletCustom?.width ?? selectedPallet.width,
      height: palletCustom?.height,
      weightKg: palletCustom?.weightKg,
    } as PalletPreset;

    if (field === "name") {
      (next as any).name = value || "Custom pallet";
    } else if (field === "weightKg") {
      (next as any).weightKg = parseFloat(value) || undefined;
    } else if (field === "height") {
      (next as any).height = value === "" ? undefined : displayToMm(value, units);
    } else if (field === "length") {
      (next as any).length = displayToMm(value, units);
    } else if (field === "width") {
      (next as any).width = displayToMm(value, units);
    }

    setCustomPallet(next as any);
  };

  const updateConstraintsField = (field: keyof Constraints, value: string | boolean) => {
    const next: Constraints = { ...constraints };
    if (field === "allowRotate") {
      next.allowRotate = Boolean(value);
    } else if (field === "aisleLengthReserve") {
      next.aisleLengthReserve = value === "" ? 0 : displayToMm(String(value), units);
    } else if (field === "wallClearance") {
      next.wallClearance = displayToMm(String(value), units);
    } else if (field === "betweenClearance") {
      next.betweenClearance = displayToMm(String(value), units);
    }
    setConstraints(next);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Load Planner</h1>
        <div className="flex items-center gap-3">
          <Label htmlFor="units" className="text-sm">Units: {units === "metric" ? "Metric (mm)" : "Imperial (in)"}</Label>
          <Switch
            id="units"
            checked={units === "imperial"}
            onCheckedChange={(checked) => setUnits(checked ? "imperial" : "metric")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-4 md:p-6 space-y-6">
          <div className="space-y-3">
            <SectionTitle>Container</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1 block">Preset</Label>
                <Select value={containerId} onValueChange={onContainerPresetChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select container" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTAINER_PRESETS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {containerId === "custom" && (
                <>
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block">Name</Label>
                    <Input
                      value={containerCustom?.name || "Custom container"}
                      onChange={(e) => updateContainerField("name", e.target.value)}
                      placeholder="Custom container"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Inner length ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedContainer.innerLength, units)}
                      onChange={(e) => updateContainerField("innerLength", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Inner width ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedContainer.innerWidth, units)}
                      onChange={(e) => updateContainerField("innerWidth", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Inner height ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedContainer.innerHeight, units)}
                      onChange={(e) => updateContainerField("innerHeight", e.target.value)}
                      placeholder={`optional (${unitSuffix})`}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Max payload (kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={containerCustom?.maxPayloadKg?.toString() ?? ""}
                      onChange={(e) => updateContainerField("maxPayloadKg", e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Pallet</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1 block">Preset</Label>
                <Select value={palletId} onValueChange={onPalletPresetChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select pallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {PALLET_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {palletId === "custom" && (
                <>
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block">Name</Label>
                    <Input
                      value={palletCustom?.name || "Custom pallet"}
                      onChange={(e) => updatePalletField("name", e.target.value)}
                      placeholder="Custom pallet"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Length ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedPallet.length, units)}
                      onChange={(e) => updatePalletField("length", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Width ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedPallet.width, units)}
                      onChange={(e) => updatePalletField("width", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Height ({unitSuffix})</Label>
                    <Input
                      inputMode="decimal"
                      value={mmToDisplay(selectedPallet.height, units)}
                      onChange={(e) => updatePalletField("height", e.target.value)}
                      placeholder={`optional (${unitSuffix})`}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block">Weight (kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={palletCustom?.weightKg?.toString() ?? ""}
                      onChange={(e) => updatePalletField("weightKg", e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Constraints</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <Label htmlFor="rotate" className="text-sm">Allow rotate</Label>
                <Switch
                  id="rotate"
                  checked={constraints.allowRotate}
                  onCheckedChange={(checked) => updateConstraintsField("allowRotate", checked)}
                />
              </div>
              <div>
                <Label className="mb-1 block">Wall clearance ({unitSuffix})</Label>
                <Input
                  inputMode="decimal"
                  value={mmToDisplay(constraints.wallClearance, units)}
                  onChange={(e) => updateConstraintsField("wallClearance", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block">Between clearance ({unitSuffix})</Label>
                <Input
                  inputMode="decimal"
                  value={mmToDisplay(constraints.betweenClearance, units)}
                  onChange={(e) => updateConstraintsField("betweenClearance", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block">Aisle reserve length ({unitSuffix})</Label>
                <Input
                  inputMode="decimal"
                  value={mmToDisplay(constraints.aisleLengthReserve, units)}
                  onChange={(e) => updateConstraintsField("aisleLengthReserve", e.target.value)}
                  placeholder={`optional (${unitSuffix})`}
                />
              </div>
            </div>
          </div>

          {lastValidationErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <ul className="list-disc pl-5">
                {lastValidationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => recompute()} variant="default">Compute plan</Button>
            <Button onClick={() => reset()} variant="secondary">Reset</Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 md:p-6">
          <SectionTitle>Plan</SectionTitle>
          {plan ? (
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-xs text-slate-500">Visualizer</div>
                <div className="mt-2">
                  {/* @ts-ignore - component defined in components dir */}
                  <Visualizer plan={plan} />
                </div>
              </div>
              {/* @ts-ignore */}
              <MetricsPanel plan={plan} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No plan computed yet. Adjust inputs and click "Compute plan".</p>
          )}
        </div>
      </div>
    </div>
  );
}
