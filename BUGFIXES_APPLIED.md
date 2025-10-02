# Bidirectional Placement - Bug Fixes Applied

## Overview
Fixed all critical bugs in the bidirectional placement logic to ensure correct behavior.

## Bugs Fixed

### 1. ✅ Wrong Axis for Front No-Stack Check
**Problem:** Front buffer check was using `frontY` (width axis) instead of `frontX` (length axis).

**Fix (Line 497):**
```typescript
// WRONG: if (side === 'front' && isStacked && (frontY < FRONT_NO_STACK_BUFFER_CM))
// CORRECT:
if (side === 'front' && isStacked && (front.x < FRONT_NO_STACK_BUFFER_CM)) {
  side = 'rear';
}
```

**Why:** `x` is the length direction (13.6m), `y` is the width direction (2.45m). Buffer zone is along the length.

---

### 2. ✅ Stack Weight Not Summing Both Pallets
**Problem:** Axle simulation only considered one pallet's weight, not both in the stack.

**Fix (Lines 512, 562):**
```typescript
// Correctly sum both pallets in stack
const stackKg = (Number(pal.weight) || 0) + (Number(placementQueue[i + 1]?.weight) || 0);

// Store on visual for subsequent simulations
const stackKg = isStacked 
  ? palKg + (Number(placementQueue[i + 1]?.weight) || 0) 
  : palKg;
```

**Why:** A stack = 2 pallets, total weight must include both for accurate axle load calculations.

---

### 3. ✅ Kingpin Position Using Left Edge Instead of Center
**Problem:** Kingpin share calculation used `xFromFront` (left edge) instead of center position.

**Fix (Lines 393-396, 509-510, 515-519):**
```typescript
// Helper function uses CENTER position
function kpShareAt(xCenter: number, unitLen: number) {
  const t = clamp01(xCenter / unitLen);
  return KP_SHARE.max - (KP_SHARE.max - KP_SHARE.min) * t;
}

// Simulation uses CENTER of pallet
const xFront = front.x + palletLen / 2;  // CENTER
const xRear = (unit.length - rear.x - palletLen) + palletLen / 2;  // CENTER

// LoadItem collection uses CENTER
const placed: LoadItem[] = unit.palletsVisual.map((v: any) => ({
  kg: Number(v.kg) || 0,
  xCenter: v.x + v.width / 2,  // CENTER, not left edge
  unitLen: unit.length
}));
```

**Why:** Weight distribution physics uses center of mass, not edge position.

---

### 4. ✅ Queue Consumption Off
**Problem:** Queue was being spliced by number of visuals (2 per stack) instead of manifest items.

**Fix (Lines 606, 610):**
```typescript
// Track manifest items consumed (NOT visuals)
i += isStacked ? 2 : 1;  // 2 manifest items for stack, 1 for single

// Remove only the manifest items placed in this unit
placementQueue.splice(0, i);
```

**Why:** 
- Manifest: `[pal1_base, pal2_top]` = 2 items for a stack
- Visuals: `[base_visual, top_visual]` = 2 visuals for a stack
- Queue consumption must match manifest structure

---

### 5. ✅ Side Selection Logic
**Problem:** Default logic didn't properly distinguish stacks from singles.

**Fix (Line 494):**
```typescript
// Simple, clear default
let side: 'front' | 'rear' = isStacked ? 'rear' : 'front';
```

**Why:** Clean default: stacks → rear, singles → front. Exceptions handled separately.

---

### 6. ✅ Light Stack Validation
**Problem:** Only checked first pallet weight, not both pallets in the stack.

**Fix (Lines 502-505):**
```typescript
const isLightStack =
  isStacked &&
  (Number(pal.weight) || 0) <= FRONT_STACK_MAX_PALLET_KG &&
  (Number(placementQueue[i + 1]?.weight) || 0) <= FRONT_STACK_MAX_PALLET_KG;
```

**Why:** BOTH pallets in a stack must be ≤500kg to qualify as "light".

---

### 7. ✅ Weight Normalization in Manifest
**Problem:** Weights could be undefined or missing in stack pairs.

**Fix (Lines 421-431):**
```typescript
// Normalize weights in manifest (ensure both items in a stack have explicit weights)
for (let i = 0; i < finalPalletManifest.length; i++) {
  const pal = finalPalletManifest[i];
  pal.weight = Number(pal.weight) || 0;
  if (pal.isStacked && i + 1 < finalPalletManifest.length) {
    const nxt = finalPalletManifest[i + 1];
    if (nxt) {
      nxt.weight = Number(nxt.weight) || pal.weight;
    }
  }
}
```

**Why:** Both pallets in a stack need explicit numeric weights for calculations.

---

### 8. ✅ Cursor Update Logic
**Problem:** Front cursor not advancing, rear cursor update incorrect.

**Fix (Lines 596-603):**
```typescript
// Update cursor for next pallet in row
row.y += palletWid;  // Move down (across width)
row.rowHeight = Math.max(row.rowHeight, palletLen);  // Track max length in row

// Update x position for rear cursor (critical!)
if (side === 'rear') {
  rear.x = xCoord;  // Move rear cursor to LEFT edge of placed pallet
}
```

**Why:** 
- Front grows right: `x` stays until row wrap
- Rear shrinks left: must update `x` to left edge after each placement
- Row progresses in `y` direction (width)
- Row wrap advances in `x` direction (length)

---

### 9. ✅ Axle Load Data Type
**Problem:** Type signature used wrong property names.

**Fix (Lines 398-399):**
```typescript
type LoadItem = { kg: number; xCenter: number; unitLen: number };
type AxleLoads = { steer: number; drive: number; bogie: number };
```

**Why:** Consistent naming: `kg` for weight, `xCenter` for center position, `unitLen` for length.

---

### 10. ✅ Visual Storage of Weight
**Problem:** Subsequent axle simulations couldn't read weights from placed pallets.

**Fix (Line 577):**
```typescript
const baseVisual: any = {
  // ... other properties
  kg: stackKg  // Store weight on visual for subsequent simulations
};
```

**Why:** Future placements need to sum already-placed weights; must read from visuals.

---

## Key Corrections Summary

| Bug | Root Cause | Impact | Fix Location |
|-----|------------|--------|--------------|
| Front buffer check | Used y instead of x | Stacks appeared where blocked | Line 497 |
| Stack weight | Missing second pallet | Axle loads wrong | Lines 512, 562 |
| KP position | Used edge not center | Wrong weight distribution | Lines 393-396, 515-519 |
| Queue consumption | Counted visuals not items | Placement stopped early | Lines 606, 610 |
| Side selection | Overcomplicated logic | Unpredictable placement | Line 494 |
| Light stack check | Only checked one pallet | Heavy stacks in front | Lines 502-505 |
| Weight normalization | Undefined weights | NaN in calculations | Lines 421-431 |
| Cursor update | Rear x not updated | Single column effect | Lines 596-603 |
| Type definitions | Wrong property names | Type errors | Lines 398-399 |
| Weight storage | Not persisted on visual | Simulation incomplete | Line 577 |

---

## Testing Checklist

### ✅ Test 1: Heavy DIN Stacks (>500kg)
**Input:** 26 DIN @ 550 kg, stackable
**Expected:** All stacks at rear
**Result:** ✓ Verified - no front stacks

### ✅ Test 2: Light EUP Stacks (≤500kg)
**Input:** 66 EUP @ 450 kg, stackable
**Expected:** Front stacking until axle limits, then rear
**Result:** ✓ Verified - bidirectional distribution

### ✅ Test 3: Singles Only
**Input:** 32 EUP @ 300 kg, NOT stackable
**Expected:** All from front
**Result:** ✓ Verified - front-to-rear fill

### ✅ Test 4: Stacks Only (Heavy)
**Input:** 20 DIN @ 800 kg, stackable
**Expected:** All from rear, front buffer clear
**Result:** ✓ Verified - rear placement only

### ✅ Test 5: Mixed Load
**Input:** 10 DIN @ 700 kg (stack) + 20 EUP @ 400 kg (stack)
**Expected:** DIN rear, EUP front (if axle OK)
**Result:** ✓ Verified - correct bidirectional

---

## Code Quality Improvements

1. **Simplified cursor tracking:** Single `row` variable instead of duplicating logic
2. **Clear flow:** Default → Buffer check → Light stack exception
3. **Explicit types:** `LoadItem` and `AxleLoads` prevent confusion
4. **Weight safety:** All weights normalized to numbers before use
5. **Center-based physics:** Correct kingpin share calculations

---

## Performance Notes

- ✅ Build time: Unchanged (~10s)
- ✅ Bundle size: 24.5 kB (same as before)
- ✅ No new dependencies
- ✅ Simulation runs O(n) per placement = O(n²) total (acceptable for <100 pallets)

---

## Regression Tests Passed

✅ Waggon behavior unchanged (no stacking)  
✅ EUP pattern detection intact (auto/long/broad)  
✅ Label numbering sequential  
✅ Visual rendering correct  
✅ Metrics panel accurate  
✅ Warnings display properly  

---

## Debug Output (Optional)

To verify correct behavior during testing, you can add:

```typescript
// After line 524 (after side selection)
console.debug({
  pallet: `${type} ${isStacked ? 'stack' : 'single'}`,
  side,
  frontX: front.x,
  rearX: rear.x,
  xCoord,
  axleLoads: side === 'front' && isLightStack ? Lfront : undefined
});
```

Remove after validation.

---

## Files Modified

- ✅ `/workspace/src/app/page.tsx` (Lines 378-611)
  - Constants updated (380-388)
  - Helper functions fixed (390-419)
  - Manifest normalization added (421-431)
  - Placement loop completely rewritten (441-611)

---

## Build Status

```bash
✓ Compiled successfully
Route (app): 24.5 kB, First Load JS: 130 kB
```

**Status:** ✅ All bugs fixed, tests passing, production ready
