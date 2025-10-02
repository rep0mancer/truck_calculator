# Verification Guide - Heavy Stack Placement Logic

## Quick Test Instructions

### Setup
1. Start the application: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Select truck: "Planensattel Standard (13.2m)"

### Test Case 1: 28 DIN @ 600 kg ✓ (FAILING CASE)

**Input:**
- Truck: Planensattel Standard (13.2m) - 1320cm length
- Pallet type: Industrial (DIN)
- Weight: 600 kg per pallet
- Quantity: 28
- Stacking: Enabled
- Stack limit: 0 (unlimited)

**Expected Behavior:**

1. **Weight Classification:**
   - 600 kg > 500 kg threshold → ALL pallets are HEAVY
   - Heavy stacks cannot go in front section

2. **Rear Zone Calculation:**
   - Rear zone starts at: 1320 × 0.58 = 765.6 cm from front
   - First ~58% of truck length = singles only
   - Last ~42% of truck length = stacking allowed

3. **Visual Layout (Vertical Length):**
   ```
   TOP (y=0) ─────────────────────────
   │  Singles: 1, 2, 3, 4...         │
   │  (Front section)                │
   │                                 │
   ├─ ~765cm mark (58% threshold) ──┤
   │                                 │
   │  First stack appears here       │
   │  Stacks continue: XX/YY         │
   │                                 │
   │  Last stacks: 27/28             │
   BOTTOM (y=1320) ───────────────────
   ```

4. **Label Distribution:**
   - Top area: Lower numbered singles (1, 2, 3...)
   - Bottom area: Higher numbered stacks (e.g., 27/28)
   - Visual height > width (because length is vertical)

**Verification Points:**
- [ ] No stacks appear in first ~765cm
- [ ] First stack appears after 58% mark
- [ ] Stack pair "27/28" is near bottom
- [ ] Visual is taller than wide
- [ ] Front label appears at top

---

### Test Case 2: 26 DIN @ 550 kg ✓

**Input:**
- Same as Test Case 1, but:
  - Weight: 550 kg per pallet
  - Quantity: 26

**Expected Behavior:**
- Similar to Test Case 1
- 550 kg > 500 kg → Heavy stacks
- Same rear-zone restriction applies
- Singles at top, stacks in rear zone

**Verification Points:**
- [ ] Same pattern as Test Case 1
- [ ] No front stacks before 765cm mark
- [ ] Higher numbered stacks at bottom

---

### Test Case 3: 66 EUP @ 450 kg ✓

**Input:**
- Truck: Planensattel Standard (13.2m)
- Pallet type: Euro (EUP)
- Weight: 450 kg per pallet
- Quantity: 66
- Stacking: Enabled
- Stack limit: 0 (unlimited)

**Expected Behavior:**

1. **Weight Classification:**
   - 450 kg ≤ 500 kg threshold → Light stacks
   - Light stacks MAY go at front IF axle check passes

2. **Axle Simulation:**
   - Each light stack candidate is tested:
     - Calculate load at front position
     - Calculate load at rear position
     - Check: steer ≤ 7760 kg, drive ≤ 11155 kg, bogie ≤ 23280 kg
   - Place at front if all limits OK, else rear

3. **Visual Layout:**
   ```
   TOP (y=0) ─────────────────────────
   │  May have light stacks here     │
   │  (if axle check passes)         │
   │                                 │
   │  Mix of singles and stacks      │
   │                                 │
   │  Rear stacks when front fills   │
   BOTTOM (y=1320) ───────────────────
   ```

**Verification Points:**
- [ ] Some stacks may appear at front
- [ ] No axle limit warnings if properly distributed
- [ ] Total weight within 24000 kg limit
- [ ] Visual layout respects weight distribution

---

## Visual Orientation Check

### Before Fix (WRONG)
```
Front ──────────────────────────────────── Rear
│                                            │
│  Horizontal length (x-axis)                │
│  Vertical width (y-axis)                   │
└────────────────────────────────────────────┘
```

### After Fix (CORRECT)
```
Front (TOP)
│
│  Vertical length (y-axis)
│  Horizontal width (x-axis)
│
Rear (BOTTOM)
```

**Visual Check:**
- Container height > width (for 1320cm × 245cm truck)
- Front indicator at top
- Pallets flow downward
- Columns spread left-right

---

## Debugging Tips

### If stacks appear too early:
- Check: `HEAVY_STACK_REAR_ZONE_START_FRACTION = 0.58`
- Check: `HEAVY_STACK_REAR_START_CM` calculation
- Check: Weight > 500 kg threshold

### If no stacks at all:
- Verify stacking is enabled
- Check stack limit (0 = unlimited)
- Check buffer zone (120cm)

### If axle warnings are wrong:
- Review axle calculation in `sumLoads()`
- Check `kpShareAt()` position interpolation
- Verify tare weights and limits

### If visual orientation is wrong:
- Check `renderPallet()` coordinate mapping
- Verify container dimensions (width vs height)
- Check front label position

---

## Implementation Details

### Constants Reference
```javascript
// Stacking rules
FRONT_NO_STACK_BUFFER_CM = 120        // First 1.2m = no stacks
FRONT_STACK_MAX_PALLET_KG = 500       // Light stack threshold
HEAVY_STACK_REAR_ZONE_START_FRACTION = 0.58  // 58% from front

// Axle simulation
KP_SHARE = { min: 0.12, max: 0.35 }   // Kingpin share range
KP_TO_DRIVE = 0.70                     // 70% of KP load to drive axle
AXLE_LIMITS = { 
  STEER: 8000,   // kg
  DRIVE: 11500,  // kg
  BOGIE: 24000,  // kg
  SAFETY: 0.97   // 97% safety factor
}
TARE = { 
  steer: 6500,   // kg
  drive: 4500,   // kg
  bogie: 3000    // kg
}
```

### Side Decision Algorithm
```javascript
1. Start with: side = isStacked ? 'rear' : 'front'
2. If front && stacked && front.L < 120cm → rear
3. If heavy stack && front && front.L < 765cm → rear
4. If light stack → axle sim test (front vs rear)
```

### Coordinate Calculation
```javascript
Front: y = front.L
Rear:  y = unit.length - rear.L - palletLen
Width: x = (front|rear).W
```

---

## Success Criteria

### For 28 DIN @ 600kg:
✅ Singles fill top portion  
✅ First stack after 765cm mark  
✅ Pair 27/28 near bottom  
✅ Visual taller than wide  

### For 26 DIN @ 550kg:
✅ Similar pattern to 28 DIN  
✅ Heavy stack behavior  

### For 66 EUP @ 450kg:
✅ Light stacks may appear at front  
✅ Axle limits respected  
✅ No unnecessary warnings  

### General:
✅ Build successful  
✅ No runtime errors  
✅ Visual orientation correct  
✅ Front label at top  
