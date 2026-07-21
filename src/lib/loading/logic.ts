import { MAX_WEIGHT_PER_METER_KG, PALLET_TYPES, TRUCK_TYPES } from './definitions';
import type { EupPattern, LoadingRequest, LoadingResult, LoadingWarning, PalletRectangle, PalletType, TruckKey, WeightGroup } from './types';

type Single={type:PalletType;weightKg:number;sourceId:number;serial:number};
type Candidate={type:PalletType;items:Single[]};
type MutableUnit={unitId:string;unitLength:number;unitWidth:number;pallets:PalletRectangle[];x:number;y:number;columnWidth:number};
const known=(key:string):key is TruckKey=>Object.prototype.hasOwnProperty.call(TRUCK_TYPES,key);
const integer=(value:number,name:string)=>{if(!Number.isInteger(value)||value<0)throw new RangeError(`${name} must be a non-negative integer`)};
function validateGroups(groups:readonly WeightGroup[],name:string){for(const group of groups){integer(group.quantity,`${name}.quantity`);if(!Number.isFinite(group.weightKg)||group.weightKg<0)throw new RangeError(`${name}.weightKg must be a finite non-negative value`)}}
export function validateLoadingRequest(request:LoadingRequest):void{
 if(!known(request.truckKey))throw new RangeError('truckKey must be a known configuration');
 validateGroups(request.euro,'euro');validateGroups(request.industrial,'industrial');integer(request.maxStackedEuro,'maxStackedEuro');integer(request.maxStackedIndustrial,'maxStackedIndustrial');
}
function singles(groups:readonly WeightGroup[],type:PalletType,start:number):Single[]{let serial=start;return groups.flatMap(g=>Array.from({length:g.quantity},()=>({type,weightKg:g.weightKg,sourceId:g.id,serial:serial++})))}
function candidates(input:Single[],stackable:boolean,limit:number):Candidate[]{const eligible=stackable?(limit===0?input.length:Math.min(limit,input.length)):0;const paired=Math.floor(eligible/2)*2;const out:Candidate[]=[];for(let i=0;i<paired;i+=2)out.push({type:input[i].type,items:[input[i],input[i+1]]});for(let i=paired;i<input.length;i++)out.push({type:input[i].type,items:[input[i]]});return out}
function dimensions(type:PalletType,pattern:EupPattern,count:number):[number,number]{if(type==='industrial')return[100,120];const selected=pattern==='auto'?(count>=3?'long':'broad'):pattern;return selected==='long'?[120,80]:[80,120]}
function position(unit:MutableUnit,w:number,h:number):{x:number;y:number}|undefined{if(unit.y+h<=unit.unitWidth&&unit.x+w<=unit.unitLength)return{x:unit.x,y:unit.y};const nx=unit.x+unit.columnWidth;if(nx+w<=unit.unitLength&&h<=unit.unitWidth){unit.x=nx;unit.y=0;unit.columnWidth=0;return{x:nx,y:0}}}
export function calculateLoadingLogic(request:LoadingRequest):LoadingResult{
 validateLoadingRequest(request);const spec=TRUCK_TYPES[request.truckKey];const warnings:LoadingWarning[]=[];
 const eup=singles(request.euro,'euro',1),din=singles(request.industrial,'industrial',eup.length+1);const requested={euro:eup.length,industrial:din.length};
 const stacking=spec.stackingAllowed;if(!stacking&&(request.euroStackable||request.industrialStackable))warnings.push({code:'STACKING_DISABLED',values:{truckKey:request.truckKey}});
 const queues={euro:candidates(eup,stacking&&request.euroStackable,request.maxStackedEuro),industrial:candidates(din,stacking&&request.industrialStackable,request.maxStackedIndustrial)};
 const ordered=request.placementOrder==='DIN_FIRST'?[...queues.industrial,...queues.euro]:[...queues.euro,...queues.industrial];
 const units:MutableUnit[]=spec.units.map(u=>({unitId:u.id,unitLength:u.length,unitWidth:u.width,pallets:[],x:0,y:0,columnWidth:0}));let weight=0,dinBases=0,eupBases=0,stackId=0;const label={euro:0,industrial:0};
 for(const candidate of ordered){const addWeight=candidate.items.reduce((s,p)=>s+p.weightKg,0);if(weight+addWeight>spec.maxPayloadKg){continue}if(candidate.type==='industrial'&&spec.maxDinFloorPositions!==undefined&&dinBases>=spec.maxDinFloorPositions)continue;
  const [w,h]=dimensions(candidate.type,request.eupPattern,queues.euro.length);let selected:MutableUnit|undefined,pos:{x:number;y:number}|undefined;for(const unit of units){pos=position(unit,w,h);if(pos){selected=unit;break}}if(!selected||!pos)continue;
  const group=candidate.items.length===2?`stack-${++stackId}`:undefined;const ids=candidate.items.map(()=>++label[candidate.type]);candidate.items.forEach((item,tier)=>selected!.pallets.push({x:pos!.x,y:pos!.y,width:w,height:h,type:item.type,weightKg:item.weightKg,sourceId:item.sourceId,key:`${item.type}-${item.serial}`,labelId:ids[tier],unitId:selected!.unitId,isStackedTier:group?(tier===0?'base':'top'):null,stackGroupId:group,displayBaseLabelId:ids[0],displayStackedLabelId:group?ids[1]:null,showAsFraction:Boolean(group)}));
  selected.y+=h;selected.columnWidth=Math.max(selected.columnWidth,w);weight+=addWeight;if(candidate.type==='euro')eupBases++;else dinBases++;
 }
 const totalEuro=units.flatMap(u=>u.pallets).filter(p=>p.type==='euro').length,totalDin=units.flatMap(u=>u.pallets).filter(p=>p.type==='industrial').length;const rejected={euro:requested.euro-totalEuro,industrial:requested.industrial-totalDin};
 if(rejected.euro||rejected.industrial)warnings.push({code:'PALLETS_REJECTED',values:{euro:rejected.euro,industrial:rejected.industrial}});if(weight>=spec.maxPayloadKg)warnings.push({code:'PAYLOAD_REACHED',values:{limitKg:spec.maxPayloadKg}});if(spec.maxDinFloorPositions!==undefined&&dinBases>=spec.maxDinFloorPositions&&rejected.industrial)warnings.push({code:'DIN_CAPACITY_REACHED',values:{limit:spec.maxDinFloorPositions}});
 const floorArea=units.flatMap(u=>u.pallets).filter(p=>p.isStackedTier!=='top').reduce((s,p)=>s+PALLET_TYPES[p.type].area,0),area=spec.units.reduce((s,u)=>s+u.length*u.width,0),util=Math.min(100,Math.round(floorArea/area*1000)/10);const usedMetres=floorArea/spec.maxWidth/100;if(usedMetres&&weight/usedMetres>=MAX_WEIGHT_PER_METER_KG)warnings.push({code:'AXLE_DENSITY',values:{kgPerMeter:Math.round(weight/usedMetres)}});
 return{palletArrangement:units.map(({unitId,unitLength,unitWidth,pallets})=>({unitId,unitLength,unitWidth,pallets})),loadedIndustrialPalletsBase:dinBases,loadedEuroPalletsBase:eupBases,totalDinPalletsVisual:totalDin,totalEuroPalletsVisual:totalEuro,requested,rejected,utilizationPercentage:util,warnings,totalWeightKg:weight,eupLoadingPatternUsed:request.eupPattern};
}
