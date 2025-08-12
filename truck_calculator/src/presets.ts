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

export interface TruckPreset {
  id: string;
  name: string;
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
  sideDoorHeight: number;
  payloadMaxKg: number;
  rearAxleGroupMax: number;
  supportFrontX: number;
  supportRearX: number;
  clearances: {
    wallX: number;
    frontY: number;
    rearY: number;
    between: number;
  };
}

export const PRESETS: TruckPreset[] = [
  {
    name: 'Curtainsider 13.2 (tandem)',
    innerLength: 13200,
    innerWidth: 2440,
    innerHeight: 2700,
    sideDoorHeight: 2650,
    payloadMax: 24000,
    rearAxleGroupMax: 18000,
    supportFrontX: 1300,
    supportRearX: 12000,
    clearances: { wallX: 0, frontY: 0, rearY: 0, between: 0 }
  },
  {
    name: 'Curtainsider 13.2 (tridem)',
    innerLength: 13200,
    innerWidth: 2440,
    innerHeight: 2700,
    sideDoorHeight: 2650,
    payloadMax: 24000,
    rearAxleGroupMax: 24000,
    supportFrontX: 1300,
    supportRearX: 12000,
    clearances: { wallX: 0, frontY: 0, rearY: 0, between: 0 }
  },
  {
    name: 'Mega 13.2',
    innerLength: 13200,
    innerWidth: 2440,
    innerHeight: 3000,
    sideDoorHeight: 2650,
    payloadMax: 24000,
    rearAxleGroupMax: 18000,
    supportFrontX: 1300,
    supportRearX: 12000,
    clearances: { wallX: 0, frontY: 0, rearY: 0, between: 0 }
  },
  {
    name: 'City 10.0',
    innerLength: 10000,
    innerWidth: 2440,
    innerHeight: 2700,
    sideDoorHeight: 2650,
    payloadMax: 16000,
    rearAxleGroupMax: 13000,
    supportFrontX: 1000,
    supportRearX: 9000,
    clearances: { wallX: 0, frontY: 0, rearY: 0, between: 0 }
  },
];