# Bidirectional Placement - Quick Reference

## How It Works Now (Corrected)

### Coordinate System
```
Trailer (13.6m × 2.45m)
┌─────────────────────────────────────────┐
│  FRONT                           REAR   │  ← Length (x-axis)
│  x=0                            x=1360  │
│  ↓                                  ↓   │
│  Singles start here    Stacks start here│
│                                         │
└─────────────────────────────────────────┘
  ↑
  Width (y-axis): 0-245cm
```

### Decision Flow

```
For each pallet in queue:
  ├─ Is stacked?
  │  ├─ NO  → side = 'front' (default for singles)
  │  └─ YES → side = 'rear' (default for stacks)
  │           │
  │           ├─ Is front.x < 120cm? (buffer zone)
  │           │  └─ YES → side = 'rear' (hard block)
  │           │
  │           ├─ Both pallets ≤ 500kg? (light stack)
  │           │  ├─ NO → side stays 'rear'
  │           │  └─ YES → run axle simulation
  │           │           ├─ Front OK? → side = 'front'
  │           │           └─ Front exceeds? → side = 'rear'
  │
  └─ Place at chosen side
     ├─ Front: place at front.x, advance right
     └─ Rear: place at (rear.x - length), move rear.x left
```

### Axle Load Calculation

```typescript
// 1. Find pallet center
xCenter = x + width/2

// 2. Calculate kingpin share (varies by position)
t = xCenter / trailerLength  // 0=front, 1=rear
kpShare = 0.35 - (0.35 - 0.12) × t

// 3. Distribute weight
kingpinLoad = palletWeight × kpShare
trailerLoad = palletWeight × (1 - kpShare)

// 4. Split kingpin load
steer += kingpinLoad × 0.30  (30%)
drive += kingpinLoad × 0.70  (70%)
bogie += trailerLoad

// 5. Check limits (with 3% safety buffer)
steer ≤ 8000 × 0.97 = 7760 kg
drive ≤ 11500 × 0.97 = 11155 kg
bogie ≤ 24000 × 0.97 = 23280 kg
```

### Example: Light Stack at Front

```
Pallet: 2× EUP @ 450kg = 900kg total
Position: front.x = 200cm
Trailer: 1320cm long

1. Center: xCenter = 200 + 60 = 260cm (EUP width 120/2)
2. t = 260/1320 = 0.197
3. kpShare = 0.35 - (0.23 × 0.197) = 0.305
4. kingpinLoad = 900 × 0.305 = 274.5kg
   trailerLoad = 900 × 0.695 = 625.5kg
5. steer = 6500 + (274.5 × 0.3) = 6582.4kg ✓
   drive = 4500 + (274.5 × 0.7) = 4692.2kg ✓
   bogie = 3000 + 625.5 = 3625.5kg ✓

Result: ALL within limits → placed at FRONT
```

### Example: Same Stack at Rear

```
Position: rear.x = 1220cm (100cm from end)
Center: xCenter = 1220 + 50 = 1270cm (DIN width 100/2)

1. t = 1270/1320 = 0.962
2. kpShare = 0.35 - (0.23 × 0.962) = 0.129
3. kingpinLoad = 900 × 0.129 = 116.1kg
   trailerLoad = 900 × 0.871 = 783.9kg
4. steer = 6500 + (116.1 × 0.3) = 6534.8kg ✓
   drive = 4500 + (116.1 × 0.7) = 4581.3kg ✓
   bogie = 3000 + 783.9 = 3783.9kg ✓

Result: FRONT was better (lower bogie), but REAR also OK
```

## Constants (Configurable)

```typescript
// Lines 381-388 in page.tsx

FRONT_NO_STACK_BUFFER_CM: 120     // Front zone: no heavy stacks
FRONT_STACK_MAX_PALLET_KG: 500    // Light = both pallets ≤ this

KP_SHARE: { min: 0.12, max: 0.35 } // Kingpin share range
KP_TO_DRIVE: 0.70                  // 70% KP load → drive axle

AXLE_LIMITS: {
  STEER: 8000,    // Steering axle max (kg)
  DRIVE: 11500,   // Drive axle max (kg)
  BOGIE: 24000,   // Trailer bogie max (kg)
  SAFETY: 0.97    // 97% of max = 3% buffer
}

TARE: {
  steer: 6500,    // Empty steering axle (kg)
  drive: 4500,    // Empty drive axle (kg)
  bogie: 3000     // Empty trailer bogie (kg)
}
```

## Key Variables

```typescript
// Cursor state
front = { x: 0, y: 0, rowHeight: 0 }
rear = { x: 1320, y: 0, rowHeight: 0 }

// Pallet dimensions (cm)
EUP: 120 × 80
DIN: 120 × 100

// Orientation in trailer
EUP long:  length=120, width=80
EUP broad: length=80, width=120
DIN:       length=100, width=120 (transverse)

// Direction
x = length axis (0→1320cm, front→rear)
y = width axis (0→245cm, left→right when viewed from rear)
```

## Cursor Behavior

### Front Cursor (grows right)
```
Initial: front.x = 0

Place pallet:
  x: front.x
  y: front.y
  
After place:
  front.y += palletWidth  (move down in row)
  front.rowHeight = max(rowHeight, palletLength)

Row wrap (y > 245):
  front.x += front.rowHeight  (move right to next row)
  front.y = 0
  front.rowHeight = 0
```

### Rear Cursor (grows left)
```
Initial: rear.x = 1320 (trailer length)

Place pallet:
  x: rear.x - palletLength
  y: rear.y
  
After place:
  rear.x = (rear.x - palletLength)  ← CRITICAL!
  rear.y += palletWidth
  rear.rowHeight = max(rowHeight, palletLength)

Row wrap (y > 245):
  rear.x -= rear.rowHeight  (move left to next row)
  rear.y = 0
  rear.rowHeight = 0
```

## Queue Consumption

```typescript
// For each placement
i += isStacked ? 2 : 1

// Stack: consume 2 manifest items
placementQueue[i]     = base pallet
placementQueue[i+1]   = top pallet
→ i += 2

// Single: consume 1 manifest item
placementQueue[i]     = single pallet
→ i += 1

// After unit filled
placementQueue.splice(0, i)  // Remove placed items
```

## Visual Creation

```typescript
// Single pallet
baseVisual = {
  x: xCoord,
  y: row.y,
  width: palletLength,
  height: palletWidth,
  kg: palletWeight,  ← stored for next simulation
  // ...
}
visuals.push(baseVisual)

// Stacked pallet
baseVisual = {
  kg: weight1 + weight2,  ← SUM both pallets
  isStackedTier: 'base',
  showAsFraction: true,
  displayStackedLabelId: nextId,
  // ...
}
topVisual = {
  ...baseVisual,
  isStackedTier: 'top',
  labelId: stackedLabelId
}
visuals.push(baseVisual)
visuals.push(topVisual)
```

## Common Scenarios

| Scenario | Result |
|----------|--------|
| 30 EUP @ 300kg, stackable | Front stacking (light + axle OK) |
| 30 EUP @ 600kg, stackable | Rear stacking (heavy) |
| 26 DIN @ 550kg, stackable | Mix: some front if early, rest rear |
| 66 EUP @ 450kg, stackable | Front until limits, then rear |
| 32 EUP @ 400kg, NOT stackable | All front (singles) |
| 20 DIN @ 800kg, stackable | All rear (heavy stacks) |

## Troubleshooting

### All stacks at rear (none in front)
- Check weights: are they all >500kg?
- Check axle simulation: add console.log to withinLimits()
- Verify TARE weights match your truck

### Stacks in front buffer zone
- Heavy stacks shouldn't be there
- Check: front.x < 120 && isStacked && weight > 500
- Should force side = 'rear'

### Single vertical column
- Fixed! Was cursor update bug
- Verify: rear.x = xCoord after each rear placement

### Axle warnings despite simulation
- TARE weights may be wrong
- SAFETY factor may be too aggressive
- Check actual vs simulated loads

## Debug Snippet

```typescript
// Add after line 524 in placement loop
console.debug({
  i,
  type: pal.type,
  isStacked,
  weight1: Number(pal.weight),
  weight2: isStacked ? Number(placementQueue[i+1]?.weight) : null,
  side,
  frontX: front.x,
  rearX: rear.x,
  xCoord,
  loads: isLightStack ? { Lfront, Lrear } : null
});
```

Remove after validation.

---

**Status:** ✅ Production Ready  
**Build:** Successful  
**Tests:** Passing  
**Version:** 2.0 (Corrected)
