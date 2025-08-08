
# PROJECT BRIEF 

You’re upgrading an existing Next.js app that calculates truck/container load plans.
Repo path: `/truck_calculator-main/truck_calculator` (Next.js App Router, Tailwind, shadcn/ui).
Current core file: `src/containerSlots.js` with hardcoded slot maps.

## GOAL

Ship a **polished, mobile-friendly load planning tool** with:

* Dynamic calculations (custom container/pallet sizes, rotation, margins).
* Visual layout preview (SVG).
* Utilization metrics (area/volume), weight summary, and simple presets.
* Export (PDF/PNG) and “Save/Share plan” (localStorage + sharable URL).
* Clear docs + screenshots.

Monetization-ready: keep a simple **“Pro” feature gate** (export + share) behind one flag so it can be paywalled later.

---

## TECH AND LIBRARIES

* Next.js (existing, App Router).
* Tailwind + shadcn/ui (existing).
* State: `zustand` (lightweight) or `jotai` (pick one).
* Validation: `zod`.
* Export: client-side `html2canvas` + `jspdf` for now (fastest path).
* No server DB. Persist locally; share via URL query (compressed JSON string).

Install:

```bash
pnpm add zustand zod jspdf html2canvas
```

---

## ARCHITECTURE & TYPES

Create `src/types.ts`:

```ts
export type Units = 'metric' | 'imperial';

export interface ContainerPreset {
  id: string; name: string;
  innerLength: number; // mm
  innerWidth: number;  // mm
  innerHeight?: number; // mm
  maxPayloadKg?: number;
}

export interface PalletPreset {
  id: string; name: string;
  length: number; // mm
  width: number;  // mm
  height?: number; // mm
  weightKg?: number; // typical pallet weight if provided
}

export interface Constraints {
  allowRotate: boolean;
  wallClearance: number;   // mm
  betweenClearance: number; // mm
  aisleLengthReserve?: number; // mm, optional reserved length for walkway
}

export interface Placement {
  x: number; y: number;    // mm, top-left
  w: number; h: number;    // mm
  rotated: boolean;
  idx: number;             // running index for label
}

export interface Plan {
  container: ContainerPreset;
  pallet: PalletPreset;
  constraints: Constraints;
  units: Units;
  placements: Placement[];
  metrics: {
    count: number;
    floorAreaUsedRatio: number; // 0..1
    volumeUsedRatio?: number;   // if heights given
    totalPalletWeightKg?: number;
    maxPayloadExceeded?: boolean;
  };
  note?: string;
}
```

---

## PRESETS

Create `src/presets.ts` with realistic EU defaults (inner dimensions):

```ts
import { ContainerPreset, PalletPreset } from './types';

export const CONTAINER_PRESETS: ContainerPreset[] = [
  { id: 'sprinter', name: 'Van (Sprinter L3H2)', innerLength: 4300, innerWidth: 1780, innerHeight: 1900, maxPayloadKg: 1200 },
  { id: 'truck7_5t', name: 'Box Truck 7.5t', innerLength: 6100, innerWidth: 2400, innerHeight: 2300, maxPayloadKg: 3000 },
  { id: 'eu_semitrailer', name: 'EU Trailer 13.6m', innerLength: 13600, innerWidth: 2460, innerHeight: 2700, maxPayloadKg: 24000 },
  { id: '20ft', name: 'ISO Container 20ft', innerLength: 5898, innerWidth: 2352, innerHeight: 2393, maxPayloadKg: 28200 },
  { id: '40ft', name: 'ISO Container 40ft', innerLength: 12032, innerWidth: 2352, innerHeight: 2393, maxPayloadKg: 26800 },
];

export const PALLET_PRESETS: PalletPreset[] = [
  { id: 'euro', name: 'EUR Pallet 1200×800', length: 1200, width: 800, height: 144, weightKg: 25 },
  { id: 'industrial', name: 'Industrial 1200×1000', length: 1200, width: 1000, height: 150, weightKg: 30 },
  { id: 'half_euro', name: 'Half EUR 800×600', length: 800, width: 600, height: 140, weightKg: 10 },
];
```

---

## LAYOUT ENGINE (MVP HEURISTIC)

Create `src/lib/layoutEngine.ts`. Replace reliance on `containerSlots.js` with a **dynamic grid heuristic**:

1. Compute fit for **orientation A** (pallet L along container L)
2. Compute fit for **orientation B** (rotated 90°)
3. Optionally try **“last row rotated”** heuristic to fill leftover width.
4. Choose plan with highest count; break ties by higher area usage.

Pseudocode:

```
Given container (CL, CW), pallet (PL, PW), clearances (wall, between),
optional aisleReserve along length.

effectiveLength = CL - 2*wall - (aisleReserve || 0)
effectiveWidth  = CW - 2*wall

For orientation A:
  colsA = floor((effectiveLength + between) / (PL + between))
  rowsA = floor((effectiveWidth  + between) / (PW + between))
  countA = max(colsA,0) * max(rowsA,0)
  placementsA = grid placements, spacing by between

For orientation B (swap PL/PW):
  compute colsB, rowsB, countB, placementsB

For mixed heuristic:
  fill rows with A, then try to fill leftover width with rotated pallets B
  (only if leftoverWidth >= rotated pallet width + between)
  compute countMix and placementsMix

Pick best of A/B/Mix. Compute metrics:
  floorAreaUsedRatio = (sum pallet area) / (CL*CW)
  totalWeight = count * (pallet.weightKg || 0)
  maxPayloadExceeded = totalWeight > (container.maxPayloadKg || Infinity)
```

Return a `Plan`.

Unit handling: internally use **mm**. Convert UI inputs to mm on ingest and back for display.

---

## STATE & VALIDATION

Create `src/store.ts` using `zustand` to hold:

* Selected container/pallet (from presets or “Custom”).
* Constraints (rotate, clearances, aisle reserve).
* Units (metric default).
* Current `Plan`.

Create `src/validation.ts` with `zod` schemas for inputs. Validate on change; show inline errors.

---

## UI IMPLEMENTATION

Replace the current barebones `app/page.tsx` with a planner UI:

* `src/app/page.tsx`:

  * Left panel (Form):

    * Dropdowns: Container preset, Pallet preset.
    * “Custom” buttons reveal numeric inputs (length, width, height, payload).
    * Toggles: allow rotate.
    * Numeric inputs: wall clearance (mm), between clearance (mm), aisle reserve (mm).
    * Units toggle (metric/imperial). Convert inputs on toggle.
    * Buttons: “Compute Plan”, “Reset”.
  * Right panel:

    * `Visualizer` (SVG) of placements with scale legend.
    * Metrics: total pallets, floor area %, volume % (if heights), total est. weight, payload warning badge.
    * Actions (Pro-gated via flag): “Export PDF”, “Export PNG”, “Save Plan”, “Copy Share Link”.

Use existing shadcn/ui components from `src/components/ui` for inputs, selects, alerts, toasts.

---

## VISUALIZER (SVG)

Create `src/components/Visualizer.tsx`:

* Render container as outer rect scaled to fit available width.
* Draw each `Placement` as a rect; label small index numbers.
* Add simple legend (pallet dims, rotate indication).
* Provide a callback to export the SVG as PNG (via `html2canvas`) and to embed in PDF.

---

## EXPORT & SHARE

Create `src/lib/export.ts`:

* `exportPNG(domNode: HTMLElement): Promise<Blob>`
* `exportPDF({ plan, node }): Promise<Blob>`: A4 portrait; first page diagram, second page a table (container, constraints, counts, metrics).

Create `src/lib/share.ts`:

* `serializePlanToQuery(plan): string` — compress JSON (use `encodeURIComponent` + Base64 ok for now).
* `deserializePlanFromQuery(q): Plan`.
* Persist latest plan to localStorage. On load, hydrate from query if present.

“Pro gating” (simple, no payments yet):

* `NEXT_PUBLIC_PRO_ENABLED=true` in `.env.local`.
* If false, show a modal explaining Pro is needed for Export/Share and disable buttons.

---

## MIGRATION AWAY FROM HARDCODED SLOTS

* Keep `src/containerSlots.js` but **do not** use it in the new engine.
* Add a small “Classic mode” switch (optional) that displays the old static layouts for comparison. Default to new engine.

---

## ERROR STATES & EDGE CASES

* If effective dimensions < pallet size, show a non-blocking warning: “Pallets do not fit with current clearances.”
* If `maxPayloadExceeded`, show prominent warning badge.
* Clamp any negative counts to zero.
* Debounce computations on input change; recompute instantly when user clicks “Compute Plan”.

---

## TESTS (CORE)

Add `vitest` and a few unit tests for the layout engine:

```bash
pnpm add -D vitest @types/jest
```

`src/lib/layoutEngine.test.ts`:

* 20ft + EUR pallet with default clearances → expected count.
* Rotation off vs on → on should be >= off.
* Aisle reserve reduces count as expected.
* Mixed heuristic outperforms pure A/B in a crafted case.

---

## STYLING & RESPONSIVENESS

* Ensure the planner works cleanly on **mobile** (<= 390px width).
* Larger touch targets for inputs.
* Add a top navbar with app name and link to README.

---

## README OVERHAUL

Rewrite `README.md` at repo root:

* What it does (screenshots/GIFs).
* Who it’s for (logistics planners, SMEs, drivers).
* Features list and “Pro” items.
* Quick start.
* Example: “20ft with 1200×800 pallets; 60 mm wall clearance; 50 mm between; rotate on.”
* FAQ: units, accuracy, known limitations (no 3D stacking, no axle load calc yet).

Add `/public/og-image.png` and screenshots in `/public/screens`.

---

## NICE-TO-HAVES (IF TIME PERMITS)

* Drag & drop manual adjustment of specific pallets on the SVG (update metrics live).
* Print stylesheet for browser print-to-PDF fallback.
* PWA (offline) toggle using Next PWA plugin.
* Additional presets (mega trailer, double-deck, reefers) behind a feature flag.

---

## ACCEPTANCE CRITERIA (CHECKLIST)

* [ ] User can select preset or enter **custom** container/pallet sizes.
* [ ] User can set rotate on/off, wall and between clearances, aisle reserve.
* [ ] App computes plan via new `layoutEngine` and renders **SVG preview**.
* [ ] Shows metrics: count, floor area %, volume % (if heights), weight total, payload warning.
* [ ] Export PNG and PDF work (when `NEXT_PUBLIC_PRO_ENABLED=true`).
* [ ] “Save Plan” stores to localStorage; “Copy Share Link” encodes plan to URL and can be restored on open.
* [ ] Mobile layout is usable, no overflow; inputs accessible.
* [ ] README updated with screenshots and usage.
* [ ] At least 4 passing unit tests for layout engine.

---

## IMPLEMENTATION ORDER

1. Types + presets (`types.ts`, `presets.ts`).
2. Layout engine (`lib/layoutEngine.ts`) + tests.
3. Store + validation (`store.ts`, `validation.ts`).
4. Planner UI (replace `app/page.tsx`), wire to engine.
5. Visualizer component (SVG) + metrics panel.
6. Export (PNG/PDF) + Share (URL + localStorage) + Pro flag.
7. Styling polish, mobile pass.
8. README + screenshots.
9. Final test run.

---

## NOTES ABOUT UNITS

* Internally operate in **mm**.
* If user selects imperial, convert on input/output only.
* Keep numeric precision to 0 decimals for mm, 1 decimal for inches in UI.

---

When done, provide:

* Summary of changes.
* Short demo GIF recorded at 1280×720 showing input → compute → export.
* Exact counts for a 20ft container with EUR pallets at defaults, to verify determinism.

---

If anything is unclear, propose a default and proceed.
