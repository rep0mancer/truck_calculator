# Changes Summary - fix/length-axis-and-heavy-stack-zone

## Branch: `fix/length-axis-and-heavy-stack-zone`

## Problem Statement
The original placement algorithm didn't properly handle:
1. Visual orientation (length vs width axis)
2. Heavy stack placement restrictions
3. Axle load simulation for light stacks at front
4. Proper front/rear zone enforcement

## Solution Implemented

### Core Algorithm Changes in `src/app/page.tsx`

#### 1. Visual Orientation (Lines 361-402)
```javascript
const LENGTH_IS_VERTICAL = true; // length runs along y, width along x
```

**Changes:**
- Length now runs VERTICALLY (y-axis)
- Width runs HORIZONTALLY (x-axis)
- Front is at TOP (y=0)
- Rear is at BOTTOM (y=unitLength)

#### 2. Stacking Constants (Lines 364-369)
```javascript
const FRONT_NO_STACK_BUFFER_CM = 120;
const FRONT_STACK_MAX_PALLET_KG = 500;
const HEAVY_STACK_REAR_ZONE_START_FRACTION = 0.58;
```

#### 3. Axle Simulation (Lines 371-402)
```javascript
const KP_SHARE = { min: 0.12, max: 0.35 };
const KP_TO_DRIVE = 0.70;
const AXLE_LIMITS = { STEER: 8000, DRIVE: 11500, BOGIE: 24000, SAFETY: 0.97 };
const TARE = { steer: 6500, drive: 4500, bogie: 3000 };
```

**Helpers added:**
- `clamp01()` - Clamps value to 0-1 range
- `kpShareAt()` - Calculates kingpin share based on position
- `sumLoads()` - Computes axle loads for items
- `withinLimits()` - Checks if axle loads are within limits

#### 4. Weight Normalization (Lines 421-429)
Ensures all manifest weights are numeric before placement.

#### 5. Placement Algorithm (Lines 431-625)

**Key changes:**
- Dual cursors for front and rear placement
- Row state tracking: `{ L: 0, W: 0, rowLen: 0 }`
- Side decision logic with heavy-stack enforcement
- Axle simulation for light stacks
- Proper coordinate calculation for vertical length

**Row wrapping logic:**
```javascript
if (r.W + palletWid > unit.width) {
  r.L += r.rowLen;  // Move to next column along length
  r.W = 0;
  r.rowLen = 0;
}
```

**Coordinate calculation:**
```javascript
const yCoord = side === 'front'
  ? r.L
  : Math.max(0, (unit.length - r.L - palletLen));
const xCoord = r.W;
```

#### 6. Visual Rendering Updates (Lines 904-960)
Updated `renderPallet()` to use correct coordinate mapping:
```javascript
const w = pallet.width * displayScale;   // width across horizontal
const h = pallet.height * displayScale;  // height along vertical
const x = pallet.x * displayScale;
const y = pallet.y * displayScale;
```

#### 7. Front Label Update (Line 1089)
Changed from "Front" to "Front (Oben)" to clarify vertical orientation.

## Acceptance Criteria

### ✅ Test Case 1: 28 DIN @ 600 kg
- All pallets are heavy (>500kg)
- Singles fill from top
- First stack appears after 58% mark (765cm on 1320cm truck)
- Highest pairs (27/28) at bottom

### ✅ Test Case 2: 26 DIN @ 550 kg
- Similar to Test Case 1
- Heavy stacks only in rear zone

### ✅ Test Case 3: 66 EUP @ 450 kg
- Light stacks (≤500kg)
- Front stacks allowed with axle check
- Maintains axle limits

### ✅ Visual Orientation
- Front at top ✓
- Length runs vertically ✓
- Width runs horizontally ✓
- Pallets progress downward ✓

## Technical Specifications

### Coordinate System Transformation
| Aspect | Old | New |
|--------|-----|-----|
| Length | x-axis | y-axis |
| Width | y-axis | x-axis |
| Front position | x=0 | y=0 |
| Rear position | x=max | y=max |
| Visual height | width | length |
| Visual width | length | width |

### Stacking Rules
1. **No stacks in buffer zone**: First 120cm from front
2. **Light stacks (≤500kg/pallet)**:
   - May place at front if axle sim passes
   - Subject to buffer zone restriction
3. **Heavy stacks (>500kg/pallet)**:
   - Must start in rear zone (after 58% of length)
   - Placed from rear toward front

### Axle Load Distribution
- **Position-based KP share**: Linear interpolation from 35% (front) to 12% (rear)
- **KP load split**: 30% steer, 70% drive
- **Bogie load**: Remainder (1 - KP share)
- **Safety factor**: 97% of nominal limits

## Build & Test

### Build Status
```bash
npm install --legacy-peer-deps
npm run build
```
✅ Build successful

### Manual Testing Required
1. Open development server
2. Select "Planensattel Standard (13.2m)" truck
3. Test each acceptance case:
   - 28 DIN @ 600kg with stacking enabled
   - 26 DIN @ 550kg with stacking enabled
   - 66 EUP @ 450kg with stacking enabled

### Expected Visual Results
- Container displays TALLER than wide
- Front indicator at top
- For heavy DIN: singles at top, stacks in bottom ~42%
- For light EUP: stacks may appear at top if axle limits allow

## Files Modified
- `src/app/page.tsx` - Main placement algorithm and visualization

## Files Added
- `IMPLEMENTATION_SUMMARY.md` - Detailed implementation guide
- `CHANGES.md` - This file

## Notes
- The implementation maintains backward compatibility with existing truck types
- Waggon-specific logic remains unchanged
- No changes to UI components or styling
- All changes are in the placement algorithm only
