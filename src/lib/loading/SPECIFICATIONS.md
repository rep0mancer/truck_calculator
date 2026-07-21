# Loading-engine specification register

**Revision:** 2026-07-21. **Status:** engineering fixtures awaiting logistics/vehicle-domain-owner approval. Do not treat these values as real-world loading guarantees until that approval is recorded here.

The centimetre dimensions and nominal payloads below preserve the production calculator values that existed when the engine was extracted. They are internal planning assumptions, not manufacturer or regulatory ratings.

| Configuration | Internal dimensions (cm) | Payload (kg) | DIN restriction | Source |
|---|---:|---:|---:|---|
| roadTrain | 2 × 720 × 245 | 24,000 | geometric | production calculator, revision above |
| curtainSider | 1320 × 245 | 24,000 | geometric | production calculator, revision above |
| frigo | 1320 × 245 | 18,300 | geometric | production calculator, revision above |
| smallTruck | 720 × 245 | 10,000 | geometric | production calculator, revision above |
| Waggon (POE) | 1370 × 290 | 24,000 | 26 floor positions | production calculator, revision above |
| Waggon2 (KRM) | 1600 × 290 | 24,000 | 28 floor positions | production calculator, revision above |

Euro pallets are 120 × 80 cm and DIN/industrial pallets are 120 × 100 cm. Road vehicles permit two-tier pairing; both wagon fixtures prohibit stacking. `long` EUP positions use 120 cm longitudinal × 80 cm transverse; `broad` uses 80 × 120; `auto` selects long for at least three EUP floor candidates and broad otherwise. The axle-density advisory threshold is 1,800 kg/m. These pallet dimensions, wagon patterns, stacking restriction, and threshold all come from the pre-extraction production calculator as revised above and likewise require domain approval.

Golden fixtures in `logic.test.ts` are approved only as software-regression baselines. A logistics or vehicle-domain owner must record name, role, date, and source-document revisions here before they become domain-approved guarantees.
