# Configuration Guide - Bidirectional Placement System

## Quick Configuration Reference

All configuration constants are located in `/workspace/src/app/page.tsx` starting at **line 380**.

---

## Core Constants

### Front Buffer Zone
```typescript
const FRONT_NO_STACK_BUFFER_CM = 120;  // cm
```

**Purpose:** Prevents heavy stacks from being placed in the front buffer zone.

**Default:** 120 cm (1.2 meters)

**When to adjust:**
- Increase if you need more clearance for loading/unloading
- Decrease if you want to maximize capacity
- Typical range: 80-150 cm

**Example:**
```typescript
const FRONT_NO_STACK_BUFFER_CM = 100;  // More aggressive packing
const FRONT_NO_STACK_BUFFER_CM = 150;  // More conservative, safer
```

---

### Stack Placement Bias
```typescript
const STACKS_FROM_REAR = true;
```

**Purpose:** Controls default placement direction for stacks.

**Default:** `true` (stacks prefer rear)

**Options:**
- `true`: Stacks go to rear by default (recommended for stability)
- `false`: Stacks go to front by default (not recommended)

**When to change:** Only if your loading strategy specifically requires front-first stacking (rare).

---

## Axle Load Limits

### Weight Limits (LIMITS object)
```typescript
const LIMITS = {
  STEER_MAX_KG: 8000,              // Steering axle maximum
  DRIVE_MAX_KG: 11500,             // Drive axle maximum  
  TRAILER_BOGIE_MAX_KG: 24000,     // Trailer bogie maximum
  SAFETY: 0.97,                    // Safety factor (3% buffer)
  FRONT_STACK_MAX_PALLET_KG: 500   // Light stack threshold
};
```

### STEER_MAX_KG
**Purpose:** Maximum allowed weight on steering axle

**Default:** 8000 kg (8 tons)

**Typical values:**
- Light truck (4x2): 6000-7500 kg
- Standard truck (4x2): 7500-8000 kg  
- Heavy truck (6x2/6x4): 8000-9000 kg

**How to determine:**
1. Check your truck's technical documentation
2. Look at the registration certificate (Zulassungsbescheinigung Teil 1)
3. Consult manufacturer specifications

### DRIVE_MAX_KG
**Purpose:** Maximum allowed weight on drive axle(s)

**Default:** 11500 kg (11.5 tons)

**Typical values:**
- Single drive axle (4x2): 10000-11500 kg
- Tandem drive (6x2): 19000-20000 kg
- Tandem drive (6x4): 19000-20000 kg

**Example configurations:**
```typescript
// Standard 4x2 tractor
DRIVE_MAX_KG: 11500

// 6x2 tractor with tandem drive
DRIVE_MAX_KG: 19000
```

### TRAILER_BOGIE_MAX_KG
**Purpose:** Maximum allowed weight on trailer axle group

**Default:** 24000 kg (24 tons)

**Typical values:**
- 2-axle trailer: 18000-20000 kg
- 3-axle trailer: 24000-27000 kg

**Example:**
```typescript
// 2-axle trailer
TRAILER_BOGIE_MAX_KG: 18000

// 3-axle trailer
TRAILER_BOGIE_MAX_KG: 27000
```

### SAFETY
**Purpose:** Safety factor to keep below absolute maximum

**Default:** 0.97 (97% of maximum = 3% safety buffer)

**Recommended values:**
- Conservative: 0.95 (5% buffer)
- Standard: 0.97 (3% buffer)
- Aggressive: 0.99 (1% buffer) - not recommended

**Calculation example:**
```
STEER_MAX_KG: 8000 kg
SAFETY: 0.97
Effective limit: 8000 × 0.97 = 7760 kg

If actual load = 7800 kg:
→ 7800 > 7760 → withinLimits = FALSE
```

### FRONT_STACK_MAX_PALLET_KG
**Purpose:** Maximum weight per pallet to qualify as "light stack"

**Default:** 500 kg

**When to adjust:**
- Increase to allow heavier stacks in front (500 → 600 kg)
- Decrease for stricter front stacking (500 → 400 kg)
- Set to 0 to disable front stacking entirely

**Impact:**
```typescript
FRONT_STACK_MAX_PALLET_KG: 600  
// → More stacks eligible for front placement

FRONT_STACK_MAX_PALLET_KG: 400  
// → Only very light stacks can go front

FRONT_STACK_MAX_PALLET_KG: 0    
// → All stacks must go rear (conservative)
```

---

## Tare Weights (TARE object)

```typescript
const TARE = {
  steer: 6500,        // kg
  drive: 4500,        // kg
  trailerBogie: 3000  // kg
};
```

**Purpose:** Empty weight of your truck/trailer combination

**Critical:** These should match YOUR actual vehicle weights!

### How to Determine Your Tare Weights

#### Method 1: Weigh Bridge (Most Accurate)
1. Drive empty truck to a certified weigh bridge
2. Get axle-by-axle weights
3. Record:
   - Steering axle weight → `TARE.steer`
   - Drive axle weight → `TARE.drive`  
   - Trailer axle weight → `TARE.trailerBogie`

#### Method 2: Registration Documents
1. Check "Zulassungsbescheinigung Teil 1"
2. Look for "Leermasse" (empty weight)
3. Approximate distribution:
   - Steer: ~40% of tractor weight
   - Drive: ~60% of tractor weight
   - Trailer: ~3000 kg (typical)

#### Method 3: Manufacturer Specs
1. Consult truck manufacturer documentation
2. Check trailer manufacturer specifications
3. Use typical values for your vehicle class

### Example Configurations

#### Standard 4x2 Tractor + 13.6m Semi-Trailer
```typescript
const TARE = {
  steer: 6500,        // Typical for MAN TGX, Scania R-Series
  drive: 4500,        // Typical for MAN TGX, Scania R-Series
  trailerBogie: 3000  // Typical curtainsider trailer
};
```

#### Light Truck + Small Trailer
```typescript
const TARE = {
  steer: 2500,        
  drive: 2000,        
  trailerBogie: 1500  
};
```

#### Heavy 6x2 Tractor + 13.6m Semi-Trailer
```typescript
const TARE = {
  steer: 7000,        
  drive: 6500,        // Tandem drive axles
  trailerBogie: 3200  
};
```

---

## Kingpin Distribution (KP_SHARE)

```typescript
const KP_SHARE = { min: 0.12, max: 0.35 };
```

**Purpose:** Defines how much weight goes through kingpin vs trailer axles

**Default:** 
- Front position (x=0): 35% through kingpin
- Rear position (x=length): 12% through kingpin

**Model:**
```
Position along trailer (t = x/length):
- t=0 (front):  35% kingpin, 65% trailer
- t=0.5 (mid):  23% kingpin, 77% trailer  
- t=1 (rear):   12% kingpin, 88% trailer
```

**When to adjust:**
- Based on actual weighbridge measurements
- If you have kingpin data from your fleet
- Consult with vehicle dynamics expert

**Advanced users only:**
```typescript
// More weight to kingpin (less stable)
const KP_SHARE = { min: 0.15, max: 0.40 };

// Less weight to kingpin (more conservative)
const KP_SHARE = { min: 0.10, max: 0.30 };
```

---

## Kingpin-to-Drive Distribution

```typescript
const KP_TO_DRIVE = 0.70;
```

**Purpose:** Of the kingpin load, how much goes to drive vs steer axle

**Default:** 0.70 (70% to drive, 30% to steer)

**Calculation:**
```
Kingpin load: 1000 kg
Steer gets: 1000 × (1 - 0.70) = 300 kg
Drive gets: 1000 × 0.70 = 700 kg
```

**Typical values:**
- Standard tractor: 0.70
- Long wheelbase: 0.75 (more to drive)
- Short wheelbase: 0.65 (more to steer)

**When to adjust:** Based on actual wheelbase and kingpin position

---

## Preset Configurations

### Configuration A: Conservative (Maximum Safety)
```typescript
const FRONT_NO_STACK_BUFFER_CM = 150;
const STACKS_FROM_REAR = true;

const LIMITS = {
  STEER_MAX_KG: 8000,
  DRIVE_MAX_KG: 11500,
  TRAILER_BOGIE_MAX_KG: 24000,
  SAFETY: 0.95,                    // 5% buffer
  FRONT_STACK_MAX_PALLET_KG: 400   // Strict limit
};
```

**Use when:**
- Safety is paramount
- Hauling fragile/high-value goods
- Uncertain about vehicle specifications

---

### Configuration B: Balanced (Recommended Default)
```typescript
const FRONT_NO_STACK_BUFFER_CM = 120;
const STACKS_FROM_REAR = true;

const LIMITS = {
  STEER_MAX_KG: 8000,
  DRIVE_MAX_KG: 11500,
  TRAILER_BOGIE_MAX_KG: 24000,
  SAFETY: 0.97,                    // 3% buffer
  FRONT_STACK_MAX_PALLET_KG: 500   // Standard limit
};
```

**Use when:**
- Normal operations
- Known vehicle specifications
- Experienced operators

---

### Configuration C: Aggressive (Maximum Capacity)
```typescript
const FRONT_NO_STACK_BUFFER_CM = 100;
const STACKS_FROM_REAR = true;

const LIMITS = {
  STEER_MAX_KG: 8000,
  DRIVE_MAX_KG: 11500,
  TRAILER_BOGIE_MAX_KG: 24000,
  SAFETY: 0.98,                    // 2% buffer
  FRONT_STACK_MAX_PALLET_KG: 600   // More permissive
};
```

**Use when:**
- Maximizing capacity is critical
- Experienced with exact vehicle weights
- **Not recommended for general use**

---

## Validation & Testing

### After Changing Configuration

1. **Rebuild the application:**
```bash
pnpm run build
```

2. **Test with known scenarios:**
- Load exactly your truck's maximum legal weight
- Verify no warnings appear
- Check that placement stops appropriately

3. **Validate axle calculations:**
- Add console.log to sumLoads function
- Verify calculated weights match expected
- Test edge cases (very light, very heavy)

### Example Test
```typescript
// Add to sumLoads function temporarily:
function sumLoads(items) {
  // ... existing code ...
  console.log('Calculated loads:', { steer, drive, bogie });
  console.log('Within limits?', 
    steer <= LIMITS.STEER_MAX_KG * LIMITS.SAFETY,
    drive <= LIMITS.DRIVE_MAX_KG * LIMITS.SAFETY,
    bogie <= LIMITS.TRAILER_BOGIE_MAX_KG * LIMITS.SAFETY
  );
  return { steer, drive, trailerBogie: bogie };
}
```

---

## Troubleshooting

### Issue: Too many stacks going to rear
**Solution:** Increase `FRONT_STACK_MAX_PALLET_KG`

### Issue: Stacks unexpectedly in front
**Solution:** Decrease `FRONT_STACK_MAX_PALLET_KG` or increase `SAFETY` factor

### Issue: "Achslast" warnings appearing frequently  
**Solutions:**
1. Verify `TARE` weights are correct
2. Increase `SAFETY` factor (0.97 → 0.95)
3. Check `LIMITS` match your vehicle

### Issue: Not enough capacity being used
**Solutions:**
1. Verify weights entered are realistic
2. Check `LIMITS` aren't too conservative
3. Review `SAFETY` factor (may be too strict)

---

## Best Practices

1. **Start Conservative:** Use Configuration B (Balanced)
2. **Measure Tare Weights:** Get actual weights from weigh bridge
3. **Test Incrementally:** Change one parameter at a time
4. **Document Changes:** Keep track of what works for your fleet
5. **Validate Results:** Compare simulations to actual loads

---

## Support & References

- Vehicle weights: Check registration documents (Zulassungsbescheinigung)
- Axle limits: German Road Traffic Act (StVZO §34)
- EU regulations: Directive 96/53/EC

For technical questions about weight distribution, consult:
- Vehicle manufacturer technical support
- Professional load planning services
- Certified weigh bridge operators
