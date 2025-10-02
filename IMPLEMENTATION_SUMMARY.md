# Implementation Summary: fix/length-axis-and-heavy-stack-zone

## Overview
This branch implements a new placement algorithm that uses vertical axis for trailer length and horizontal axis for width, with intelligent stacking rules based on weight and axle load simulation.

## Key Changes

### 1. Visual Orientation
- **Length axis**: VERTICAL (y-axis) - Front at top (y=0), Rear at bottom (y=length)
- **Width axis**: HORIZONTAL (x-axis)
- Row wrapping moves down the length (vertical)
- Columns spread across width (horizontal)

### 2. Stacking Rules

#### Constants Defined
```javascript
const FRONT_NO_STACK_BUFFER_CM = 120;           // No stacks in first 1.2m
const FRONT_STACK_MAX_PALLET_KG = 500;          // Light stack threshold
const HEAVY_STACK_REAR_ZONE_START_FRACTION = 0.58; // Rear zone starts at 58%
```

#### Light vs Heavy Stacks
- **Light stacks**: Each pallet ≤ 500 kg
  - May be placed at front IF axle simulation passes
  - Subject to no-stack buffer (first 120cm)
- **Heavy stacks**: Any pallet > 500 kg
  - MUST start in rear zone (after 58% of length)
  - For 1320cm truck: rear zone starts at 765.6cm

### 3. Axle Load Simulation

#### Axle Limits
```javascript
const AXLE_LIMITS = { 
  STEER: 8000 kg, 
  DRIVE: 11500 kg, 
  BOGIE: 24000 kg, 
  SAFETY: 0.97 
};
const TARE = { steer: 6500, drive: 4500, bogie: 3000 };
```

#### Load Distribution
- Kingpin (KP) share varies by position: 12-35% (front to rear)
- KP load splits: 30% to steer, 70% to drive
- Remaining load goes to bogie
- Light stacks are only placed at front if all axle limits pass

### 4. Placement Algorithm

#### Row State
```javascript
const initRow = () => ({ L: 0, W: 0, rowLen: 0 });
const front = initRow();  // Front placement cursor
const rear = initRow();   // Rear placement cursor
```

#### Coordinate Calculation
- **Front placement**: `y = front.L`
- **Rear placement**: `y = unit.length - rear.L - palletLen`
- **Width**: `x = (front|rear).W`

#### Row Wrapping
When width exceeds unit width:
1. Move cursor along length: `r.L += r.rowLen`
2. Reset width: `r.W = 0`
3. Reset row length tracker: `r.rowLen = 0`

After placing:
1. Advance width: `r.W += palletWid`
2. Track max length in row: `r.rowLen = Math.max(r.rowLen, palletLen)`

### 5. Side Decision Logic

```javascript
let side = pal.isStacked ? 'rear' : 'front';

// No-stack buffer check
if (side === 'front' && pal.isStacked && front.L < 120) {
  side = 'rear';
}

// Heavy stack rear-zone enforcement
if (isHeavyStack && side === 'front') {
  if (front.L < HEAVY_STACK_REAR_START_CM) {
    side = 'rear';
  }
}

// Light stack axle simulation
if (isLightStack) {
  // Test both front and rear positions
  // Choose front only if axle limits pass
  side = withinLimits(Lfront) ? 'front' : 'rear';
}
```

## Test Cases

### Test Case 1: 28 DIN @ 600 kg (Heavy, Stackable)
**Expected behavior:**
- All pallets are heavy (600kg > 500kg)
- Singles fill from top down
- First stack appears after 765cm mark (58% of 1320cm)
- Remaining stacks continue toward bottom
- Highest pair numbers (27/28) appear at bottom

### Test Case 2: 26 DIN @ 550 kg (Heavy, Stackable)
**Expected behavior:**
- Similar to Test Case 1
- All heavy, no front stacks before rear zone
- Singles at top, stacks in rear zone

### Test Case 3: 66 EUP @ 450 kg (Light, Stackable)
**Expected behavior:**
- Light stacks (450kg ≤ 500kg)
- Front stacks allowed if axle simulation passes
- Axle limits must be maintained
- Mix of front and rear placement based on weight distribution

## Visual Verification

### Orientation Checklist
✓ Front label at top
✓ Pallets progress downward along length
✓ Columns spread left/right across width
✓ Visualization height > width (for typical trucks)

### Heavy Stack Placement Checklist
✓ Singles appear at top
✓ First stack appears around 58% down
✓ Highest numbered stacks at bottom
✓ No stacks in first 120cm (front buffer)

### Light Stack Placement Checklist
✓ Light stacks may appear at front
✓ Axle warnings don't trigger unnecessarily
✓ Weight distribution respects axle limits

## Files Modified

### `/workspace/src/app/page.tsx`
- Added axle simulation constants and helpers
- Implemented vertical length axis placement
- Added heavy/light stack detection
- Implemented rear-zone enforcement
- Updated visual coordinate calculation
- Fixed renderPallet to use correct axis mapping
- Updated visualization labels

## Technical Details

### Coordinate System
- **Old**: Length = x-axis, Width = y-axis (horizontal length)
- **New**: Length = y-axis, Width = x-axis (vertical length)

### Weight Normalization
Ensured all weights in manifest are numeric:
```javascript
pal.weight = Number(pal.weight) || 0;
if (pal.isStacked) {
  nxt.weight = Number(nxt.weight) || pal.weight;
}
```

### Queue Consumption
Properly consume manifest items:
```javascript
i += pal.isStacked ? 2 : 1; // Stacks consume 2 items
```

## Build Status
✅ Build successful with Next.js 15.1.4
✅ No critical compilation errors
✅ Ready for testing

## Next Steps
1. Visual verification in browser
2. Test all three acceptance cases
3. Verify axle load warnings are accurate
4. Check edge cases (e.g., very heavy vs very light pallets)
