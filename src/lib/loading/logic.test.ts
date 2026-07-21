import { describe, expect, it } from 'vitest';
import { calculateLoadingLogic, TRUCK_TYPES, type LoadingRequest, type PalletRectangle, type TruckKey } from '.';
const keys=Object.keys(TRUCK_TYPES) as TruckKey[];
const base=(truckKey:TruckKey,over:Partial<LoadingRequest>={}):LoadingRequest=>({truckKey,euro:[],industrial:[],euroStackable:false,industrialStackable:false,maxStackedEuro:0,maxStackedIndustrial:0,eupPattern:'auto',placementOrder:'DIN_FIRST',...over});
function invariants(input:LoadingRequest){const result=calculateLoadingLogic(input),again=calculateLoadingLogic(input);expect(result).toEqual(again);expect(result.utilizationPercentage).toBeGreaterThanOrEqual(0);expect(result.utilizationPercentage).toBeLessThanOrEqual(100);expect(result.totalEuroPalletsVisual+result.rejected.euro).toBe(result.requested.euro);expect(result.totalDinPalletsVisual+result.rejected.industrial).toBe(result.requested.industrial);const all=result.palletArrangement.flatMap(u=>u.pallets);expect(result.totalWeightKg).toBe(all.reduce((s,p)=>s+p.weightKg,0));expect(result.totalWeightKg).toBeLessThanOrEqual(TRUCK_TYPES[input.truckKey].maxPayloadKg);expect(all.filter(p=>p.type==='euro')).toHaveLength(result.totalEuroPalletsVisual);expect(all.filter(p=>p.type==='industrial')).toHaveLength(result.totalDinPalletsVisual);
 for(const unit of result.palletArrangement){for(const p of unit.pallets){expect(p.x).toBeGreaterThanOrEqual(0);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.x+p.width).toBeLessThanOrEqual(unit.unitLength);expect(p.y+p.height).toBeLessThanOrEqual(unit.unitWidth)}const floor=unit.pallets.filter(p=>p.isStackedTier!=='top');for(let i=0;i<floor.length;i++)for(let j=i+1;j<floor.length;j++)expect(overlap(floor[i],floor[j])).toBe(false)}
 const groups=Map.groupBy(all.filter(p=>p.stackGroupId),p=>p.stackGroupId!);for(const pallets of groups.values()){expect(pallets).toHaveLength(2);expect(new Set(pallets.map(p=>`${p.unitId}:${p.x}:${p.y}:${p.width}:${p.height}`)).size).toBe(1)}
}
const overlap=(a:PalletRectangle,b:PalletRectangle)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;

describe('pairwise production matrix',()=>{const cargo=[{e:0,d:0},{e:19,d:0},{e:0,d:17},{e:11,d:9}],patterns=['auto','long','broad'] as const,flags=[[false,false],[true,false],[false,true],[true,true]] as const,limits=[0,1,2,7,8,34],orders=['DIN_FIRST','EUP_FIRST'] as const,weights=[[0,0],[1,2],[500,700],[1200,900]];keys.forEach((key,ki)=>{for(let n=0;n<24;n++){const q=cargo[(n+ki)%cargo.length],f=flags[(n*3+ki)%flags.length],w=weights[(n*5+ki)%weights.length];it(`${key} pair ${n}`,()=>invariants(base(key,{euro:[{id:1,quantity:q.e,weightKg:w[0]}],industrial:[{id:2,quantity:q.d,weightKg:w[1]}],eupPattern:patterns[(n+ki)%3],euroStackable:f[0],industrialStackable:f[1],maxStackedEuro:limits[n%limits.length],maxStackedIndustrial:limits[(n+2)%limits.length],placementOrder:orders[n%2]})))}})});

describe('discontinuities and validation',()=>{for(const key of keys)for(const quantity of [0,1,13,14,15,17,18,19,25,26,27,28,29,33,34,35,68])it(`${key} boundary ${quantity}`,()=>invariants(base(key,{euro:[{id:1,quantity,weightKg:10}],industrial:[{id:2,quantity,weightKg:10}],euroStackable:true,industrialStackable:true,maxStackedEuro:quantity,maxStackedIndustrial:quantity})));
 it.each([[-1,0],[1.2,0],[1,Infinity]])('rejects invalid quantity/weight %#',(quantity,weightKg)=>expect(()=>calculateLoadingLogic(base('curtainSider',{euro:[{id:1,quantity,weightKg}]}))).toThrow());it('rejects invalid runtime vehicle key',()=>expect(()=>calculateLoadingLogic({...base('curtainSider'),truckKey:'unknown' as TruckKey})).toThrow());});

describe('payload and group-order boundaries',()=>{for(const key of keys){const payload=TRUCK_TYPES[key].maxPayloadKg;for(const [name,groups] of [['zero',[]],['light',[{id:1,quantity:2,weightKg:1}]],['exact',[{id:1,quantity:1,weightKg:payload}]],['over',[{id:1,quantity:1,weightKg:payload+1}]],['permuted',[{id:1,quantity:2,weightKg:100},{id:2,quantity:3,weightKg:250},{id:3,quantity:1,weightKg:0}]]] as const)it(`${key} ${name}`,()=>invariants(base(key,{euro:groups})))}});

describe('deterministic randomized properties',()=>{let seed=0x51a7;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);for(let i=0;i<100;i++)it(`seed 0x51a7 case ${i}`,()=>{const key=keys[Math.floor(random()*keys.length)];invariants(base(key,{euro:[{id:1,quantity:Math.floor(random()*80),weightKg:Math.floor(random()*1500)}],industrial:[{id:2,quantity:Math.floor(random()*60),weightKg:Math.floor(random()*1800)}],euroStackable:random()>.5,industrialStackable:random()>.5,maxStackedEuro:Math.floor(random()*40),maxStackedIndustrial:Math.floor(random()*40),eupPattern:(['auto','long','broad'] as const)[Math.floor(random()*3)],placementOrder:random()>.5?'DIN_FIRST':'EUP_FIRST'}));})});

describe('approved software golden fixtures (domain approval pending)',()=>{it('standard trailer carries 33 long EUP',()=>{const r=calculateLoadingLogic(base('curtainSider',{euro:[{id:1,quantity:33,weightKg:500}],eupPattern:'long'}));expect({loaded:r.totalEuroPalletsVisual,bases:r.loadedEuroPalletsBase,weight:r.totalWeightKg}).toEqual({loaded:33,bases:33,weight:16500})});it('POE wagon DIN restriction is 26',()=>{const r=calculateLoadingLogic(base('Waggon',{industrial:[{id:1,quantity:30,weightKg:100}]}));expect({loaded:r.totalDinPalletsVisual,rejected:r.rejected.industrial}).toEqual({loaded:26,rejected:4})})});

describe('fill remaining maximality',()=>{
 for(const key of keys) for(const type of ['euro','industrial'] as const) {
  it(`${key} ${type} has no next feasible equal candidate`,()=>{
   const group={id:1,quantity:300,weightKg:0};
   const saturated=calculateLoadingLogic(base(key,{[type]:[group],placementOrder:type==='euro'?'EUP_FIRST':'DIN_FIRST'}));
   const next=calculateLoadingLogic(base(key,{[type]:[{...group,quantity:301}],placementOrder:type==='euro'?'EUP_FIRST':'DIN_FIRST'}));
   expect(type==='euro'?next.totalEuroPalletsVisual:next.totalDinPalletsVisual).toBe(type==='euro'?saturated.totalEuroPalletsVisual:saturated.totalDinPalletsVisual);
  });
 }
});
