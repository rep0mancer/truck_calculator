# Test Scenarios - Bidirectional Placement with Axle Load Check

## Test Scenario Matrix

### Scenario 1: Light EUP Stacks (Should Go Front if Axle OK)
**Input:**
- 66 EUP pallets
- 400 kg per pallet
- Stackable: YES
- Pattern: Auto

**Expected Behavior:**
- ✅ Each pallet is 400 kg ≤ 500 kg → isLightStack = true
- ✅ Axle load simulation runs for each stack
- ✅ If withinLimits(loadsFront) = true → stacks placed in FRONT
- ✅ If withinLimits(loadsFront) = false → stacks fall back to REAR
- ✅ Result: Bidirectional distribution based on actual weight distribution

**Verification Points:**
1. Check that stacks appear in front area of visualization
2. Verify no "ACHSLAST" warnings appear
3. Confirm total weight is distributed safely

---

### Scenario 2: Heavy DIN Stacks (Must Go Rear)
**Input:**
- 52 DIN pallets
- 700 kg per pallet
- Stackable: YES
- Pattern: N/A

**Expected Behavior:**
- ✅ Each pallet is 700 kg > 500 kg → isLightStack = false
- ✅ Standard rule applies: STACKS_FROM_REAR = true → side = 'rear'
- ✅ Hard block check: heavy stacks blocked from front buffer zone
- ✅ Result: ALL stacks placed in REAR area

**Verification Points:**
1. All stacks should appear in rear portion of trailer
2. Front area should be empty (no pallets in first 120cm if full)
3. No axle simulation needed (stacks are heavy)

---

### Scenario 3: Light Singles (Go Front)
**Input:**
- 33 EUP pallets
- 250 kg per pallet
- Stackable: NO
- Pattern: Long

**Expected Behavior:**
- ✅ isStacked = false → side = 'front' (default for singles)
- ✅ No axle simulation needed (not stacked)
- ✅ Result: All singles placed from FRONT

**Verification Points:**
1. All pallets appear starting from front
2. Sequential placement left-to-right, front-to-back
3. Traditional placement pattern (unchanged from original)

---

### Scenario 4: Mixed Light & Heavy Stacks
**Input:**
- 20 EUP pallets á 300 kg (stackable)
- 16 DIN pallets á 800 kg (stackable)
- Pattern: Auto

**Expected Behavior:**
- ✅ Priority sorting: DIN stacks first (heavy), then EUP stacks (light)
- ✅ DIN stacks (800 kg > 500 kg):
  - → isLightStack = false
  - → side = 'rear'
  - → Placed at REAR
- ✅ EUP stacks (300 kg ≤ 500 kg):
  - → isLightStack = true
  - → Axle simulation runs
  - → If OK → side = 'front'
  - → Placed at FRONT (if safe)

**Verification Points:**
1. DIN stacks appear in rear area
2. EUP stacks appear in front area (if axle loads permit)
3. Bidirectional distribution visible
4. No collision between front and rear cursors

---

### Scenario 5: Exactly at Threshold (500 kg)
**Input:**
- 30 EUP pallets
- 500 kg per pallet
- Stackable: YES

**Expected Behavior:**
- ✅ Each pallet is 500 kg ≤ 500 kg (inclusive) → isLightStack = true
- ✅ Axle simulation runs
- ✅ Result: Can go front IF simulation passes

**Verification Points:**
1. Verify isLightStack logic includes 500 kg (≤ not <)
2. Check axle simulation is executed
3. Placement depends on actual load distribution

---

### Scenario 6: Overloaded Scenario (Exceeds Axle Limits)
**Input:**
- 66 EUP pallets á 450 kg (stackable)
- Total: ~30,000 kg (exceeds trailer limit)

**Expected Behavior:**
- ✅ First few stacks may go front (while axle loads OK)
- ✅ As front fills, withinLimits() returns false
- ✅ Remaining stacks fall back to rear
- ✅ Eventually may hit overall weight limit

**Verification Points:**
1. First stacks in front
2. Later stacks in rear
3. Possible "Gewichtslimit erreicht" warning
4. Check that axle simulation prevents unsafe front loading

---

### Scenario 7: No Stacking (All Singles)
**Input:**
- 32 EUP pallets á 600 kg
- Stackable: NO

**Expected Behavior:**
- ✅ isStacked = false → No axle simulation
- ✅ Standard placement: all to front
- ✅ Behaves like original implementation

**Verification Points:**
1. No regression from original behavior
2. All pallets placed sequentially from front
3. No bidirectional logic needed

---

### Scenario 8: Empty Front Buffer Test
**Input:**
- 10 DIN pallets á 800 kg (stackable)
- Truck: curtainSider (13.2m)

**Expected Behavior:**
- ✅ Heavy stacks (800 kg > 500 kg)
- ✅ Hard block check at line 506:
  ```typescript
  if (side === 'front' && isStacked && !isLightStack && (frontX < FRONT_NO_STACK_BUFFER_CM))
  ```
- ✅ Result: First 120cm of front should remain clear of heavy stacks

**Verification Points:**
1. No heavy stacks in first 120cm
2. All heavy stacks start after 120cm OR go to rear
3. Front buffer visibly empty

---

### Scenario 9: Collision Prevention Test
**Input:**
- 66 EUP pallets á 400 kg (stackable)
- Manually force many to front and rear

**Expected Behavior:**
- ✅ Front cursor grows: frontX increases
- ✅ Rear cursor shrinks: rearX decreases
- ✅ Collision check (lines 571-577):
  ```typescript
  if (side === 'front' && frontX + palletLen > rearX) break;
  if (side === 'rear' && rearX - palletLen < frontX) break;
  ```
- ✅ Result: Placement stops before cursors overlap

**Verification Points:**
1. No overlapping pallets
2. Clear boundary between front and rear sections
3. No visual artifacts

---

### Scenario 10: Cursor Update Verification
**Input:**
- Mixed placement pattern
- Track cursor positions

**Expected Behavior:**
- ✅ Front cursor:
  - Starts at frontX = 0
  - Grows right: frontX += palletLen (at row wrap)
  - Position: actualX = currentX
- ✅ Rear cursor:
  - Starts at rearX = unit.length
  - Shrinks left: rearX -= palletLen (at row wrap)
  - Position: actualX = currentX - palletLen
  - After place: rearX = actualX

**Verification Points:**
1. Front pallets start at x=0
2. Rear pallets start at x=unit.length minus pallet width
3. Cursors update correctly after each placement

---

## Axle Load Simulation Tests

### Test A: Front Position Heavy Load
**Setup:**
- Place 500 kg stack at x=0 (front)
- KP share ≈ 0.35 (max)
- Stack weight: 1000 kg (2×500 kg)

**Expected Calculation:**
```
Kingpin load: 1000 × 0.35 = 350 kg
Trailer load: 1000 × 0.65 = 650 kg

Steer: 6500 + (350 × 0.30) = 6605 kg ✓ (< 7760 kg)
Drive: 4500 + (350 × 0.70) = 4745 kg ✓ (< 11155 kg)
Trailer: 3000 + 650 = 3650 kg ✓ (< 23280 kg)

Result: withinLimits = TRUE → Can place at front
```

### Test B: Rear Position Heavy Load
**Setup:**
- Place 500 kg stack at x=1300 (rear on 13.2m trailer)
- KP share ≈ 0.12 (min)
- Stack weight: 1000 kg

**Expected Calculation:**
```
Kingpin load: 1000 × 0.12 = 120 kg
Trailer load: 1000 × 0.88 = 880 kg

Steer: 6500 + (120 × 0.30) = 6536 kg ✓
Drive: 4500 + (120 × 0.70) = 4584 kg ✓
Trailer: 3000 + 880 = 3880 kg ✓

Result: withinLimits = TRUE → Can place at rear
```

### Test C: Overload Scenario
**Setup:**
- Already loaded: 20,000 kg on trailer
- Try to add 500 kg stack at rear
- Trailer bogie approaching limit

**Expected Calculation:**
```
Current trailer load: ~21,000 kg
New stack (at rear): 500 × 2 × 0.88 = 880 kg
Total trailer: 21,880 kg

Check: 21,880 > 23,280 (24000 × 0.97)?
→ FALSE (still under limit)

But if current was 22,500 kg:
→ 22,500 + 880 = 23,380 kg
→ 23,380 > 23,280
→ withinLimits = FALSE → Must reject placement
```

---

## Manual Testing Checklist

### UI Testing
- [ ] Load application at http://localhost:3000
- [ ] Select "Planensattel Standard (13.2m)"
- [ ] Enter test scenarios above
- [ ] Verify visual placement matches expected behavior
- [ ] Check warnings panel for appropriate messages
- [ ] Confirm no UI regressions

### Edge Cases
- [ ] Test with 0 pallets
- [ ] Test with 1 pallet
- [ ] Test with maximum capacity
- [ ] Test weight exactly at 500 kg
- [ ] Test weight at 499 kg and 501 kg
- [ ] Test with stackable disabled
- [ ] Test with different truck types

### Performance
- [ ] Placement completes quickly (< 1 second)
- [ ] No lag during input changes
- [ ] Axle simulation doesn't slow down large loads

### Regression Tests
- [ ] Singles-only scenario matches original behavior
- [ ] No stacking scenario matches original behavior
- [ ] Label numbering is sequential and correct
- [ ] Visual colors and styling unchanged
- [ ] Metrics panel shows correct counts

---

## Automated Test Template

```javascript
describe('Bidirectional Placement', () => {
  test('Light stacks go to front when axle loads permit', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '400', quantity: 66 }],
      [],
      true, // isEUPStackable
      false,
      'auto',
      'EUP_FIRST',
      0, 0
    );
    
    // Check that some stacks are placed in front
    const frontPallets = result.palletArrangement[0].pallets
      .filter(p => p.x < 600); // Front half
    
    expect(frontPallets.length).toBeGreaterThan(0);
  });
  
  test('Heavy stacks always go to rear', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '800', quantity: 26 }],
      false,
      true, // isDINStackable
      'auto',
      'DIN_FIRST',
      0, 0
    );
    
    // All heavy stacks should be in rear half
    const frontPallets = result.palletArrangement[0].pallets
      .filter(p => p.x < 660 && p.type === 'industrial' && p.isStackedTier);
    
    expect(frontPallets.length).toBe(0);
  });
});
```

---

## Success Criteria

✅ All 10 scenarios pass visual inspection  
✅ Axle load calculations produce expected values  
✅ No collisions between front and rear sections  
✅ Performance remains acceptable (< 1s for placement)  
✅ No regressions in existing functionality  
✅ Build completes without errors  
