import type { PalletType, TruckKey } from './types';
export interface UnitSpecification { readonly id: string; readonly length: number; readonly width: number }
export interface TruckSpecification { readonly name: string; readonly units: readonly UnitSpecification[]; readonly usableLength: number; readonly maxWidth: number; readonly maxPayloadKg: number; readonly maxDinFloorPositions?: number; readonly stackingAllowed: boolean }
export interface PalletSpecification { readonly name: string; readonly type: PalletType; readonly length: number; readonly width: number; readonly area: number; readonly color: string; readonly borderColor: string }
export const TRUCK_TYPES: Readonly<Record<TruckKey, TruckSpecification>> = {
 roadTrain:{name:'Hängerzug (2x 7,2m)',units:[{id:'unit1',length:720,width:245},{id:'unit2',length:720,width:245}],usableLength:1440,maxWidth:245,maxPayloadKg:24000,stackingAllowed:true},
 curtainSider:{name:'Planensattel Standard (13.2m)',units:[{id:'main',length:1320,width:245}],usableLength:1320,maxWidth:245,maxPayloadKg:24000,stackingAllowed:true},
 frigo:{name:'Frigo (Kühler) Standard (13.2m)',units:[{id:'main',length:1320,width:245}],usableLength:1320,maxWidth:245,maxPayloadKg:18300,stackingAllowed:true},
 smallTruck:{name:'Motorwagen (7.2m)',units:[{id:'main',length:720,width:245}],usableLength:720,maxWidth:245,maxPayloadKg:10000,stackingAllowed:true},
 Waggon:{name:'Waggon POE',units:[{id:'main',length:1370,width:290}],usableLength:1370,maxWidth:290,maxPayloadKg:24000,maxDinFloorPositions:26,stackingAllowed:false},
 Waggon2:{name:'Waggon KRM',units:[{id:'main',length:1600,width:290}],usableLength:1600,maxWidth:290,maxPayloadKg:24000,maxDinFloorPositions:28,stackingAllowed:false},
};
export const PALLET_TYPES: Readonly<Record<PalletType,PalletSpecification>>={euro:{name:'Euro Palette (1.2m x 0.8m)',type:'euro',length:120,width:80,area:9600,color:'bg-blue-500',borderColor:'border-blue-700'},industrial:{name:'Industrial Palette (1.2m x 1.0m)',type:'industrial',length:120,width:100,area:12000,color:'bg-green-500',borderColor:'border-green-700'}};
export const MAX_PALLET_SIMULATION_QUANTITY=300;
export const MAX_WEIGHT_PER_METER_KG=1800;
