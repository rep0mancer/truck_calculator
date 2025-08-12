import React, { useMemo, useState } from 'react';
import { planWithFixedSequence, checkAxles, type PackOptions } from '@truck/engine';

type Family = 'EUP' | 'DIN';
type Band = 'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked';

function NumberInput({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){
  return (
    <label style={{display:'grid',gap:4}}>
      <span style={{fontSize:12,opacity:.8}}>{label}</span>
      <input className="input" type="number" value={Number.isFinite(value)?value:''}
        onChange={e=>onChange(parseFloat(e.target.value||'0'))}/>
    </label>
  );
}

export default function App(){
  // inputs
  const [eupQty,setEupQty]=useState(32);
  const [dinQty,setDinQty]=useState(2);
  const [unitH,setUnitH]=useState(1200);
  const [eupW,setEupW]=useState(600);
  const [dinW,setDinW]=useState(800);
  const [eupStackable,setEupStackable]=useState(true);
  const [dinStackable,setDinStackable]=useState(false);
  const [eupStackCount,setEupStackCount]=useState(4);  // partial
  const [dinStackCount,setDinStackCount]=useState(0);
  const [maxStack,setMaxStack]=useState(2);
  const [frontZone,setFrontZone]=useState(2000);
  const [seq,setSeq]=useState<Band[]>(['DIN_stacked','EUP_stacked','DIN_unstacked','EUP_unstacked']);

  const preset = {
    name:'tautliner 13.6',
    innerLength: 13600, innerWidth: 2440, innerHeight: 2700,
    sideDoorHeight: 2650, payloadMax: 24000, rearAxleGroupMax: 18000,
    supportFrontX: 1300, supportRearX: 12000,
    clearances: { wallX: 0, frontY: 0, rearY: 0, between: 0 }
  };

  // Build Items and FamilyBandConfig for engine
  const items = useMemo(()=>{
    const eup = Array.from({length:eupQty}, (_,i)=>({
      id:`EUP-${i}`, family:'EUP' as Family,
      length:1200, width:800, height:unitH, weight:eupW, qty:1, allowRotate:true
    }));
    const din = Array.from({length:dinQty}, (_,i)=>({
      id:`DIN-${i}`, family:'DIN' as Family,
      length:1200, width:1000, height:unitH, weight:dinW, qty:1, allowRotate:true
    }));
    return [...eup,...din];
  },[eupQty,dinQty,unitH,eupW,dinW]);

  const famCfgs = useMemo(()=>[
    { family:'EUP' as Family, stackableCount: eupStackable? Math.max(0,Math.min(eupQty,eupStackCount)) : 0, maxStackHeight: maxStack },
    { family:'DIN' as Family, stackableCount: dinStackable? Math.max(0,Math.min(dinQty,dinStackCount)) : 0, maxStackHeight: maxStack },
  ],[eupQty,eupStackable,eupStackCount,dinQty,dinStackable,dinStackCount,maxStack]);

  const packOpts: PackOptions = {
    enforceRowPairConsistency: true,
    aisleReserve: 0,
    frontStagingDepth: frontZone,
    blockStrategy: 'fixed',
    fixedSequence: seq
  } as any;

  const [result,setResult]=useState<any>(null);
  const [axles,setAxles]=useState<any>(null);
  const [warnings,setWarnings]=useState<string[]>([]);

  function compute(){
    try{
      const plan = planWithFixedSequence(items as any, famCfgs as any, preset as any, packOpts);
      const axle = checkAxles(plan as any, preset as any, {
        linearLoadThresholdKgPerM: 2500,
        kingpinMinKg: 5000, kingpinMaxKg: 18000
      } as any);
      setResult(plan); setAxles(axle);
      setWarnings(plan.warnings ?? []);
    }catch(err:any){
      setWarnings([String(err?.message||err)]);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{marginBottom:16}}>
        <div className="row">
          <NumberInput label="EUP qty" value={eupQty} onChange={v=>setEupQty(v)} />
          <NumberInput label="DIN qty" value={dinQty} onChange={v=>setDinQty(v)} />
          <NumberInput label="Unit height (mm)" value={unitH} onChange={setUnitH} />
          <NumberInput label="EUP unit weight (kg)" value={eupW} onChange={setEupW} />
          <NumberInput label="DIN unit weight (kg)" value={dinW} onChange={setDinW} />
          <NumberInput label="Front stacking zone (mm)" value={frontZone} onChange={setFrontZone}/>
        </div>
        <div className="row">
          <label><input type="checkbox" checked={eupStackable} onChange={e=>setEupStackable(e.target.checked)}/> EUP stackable</label>
          {eupStackable && <NumberInput label="EUP stackable count" value={eupStackCount} onChange={setEupStackCount}/>}
          <label><input type="checkbox" checked={dinStackable} onChange={e=>setDinStackable(e.target.checked)}/> DIN stackable</label>
          {dinStackable && <NumberInput label="DIN stackable count" value={dinStackCount} onChange={setDinStackCount}/>}
          <NumberInput label="Max stack height" value={maxStack} onChange={v=>setMaxStack(Math.max(1,Math.floor(v)))} />
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontSize:12,opacity:.8,marginBottom:6}}>Sequence (drag later—today: click to toggle active/position)</div>
          <div className="chips">
            {(['DIN_stacked','EUP_stacked','DIN_unstacked','EUP_unstacked'] as Band[])
              .filter(b => (b.startsWith('EUP') ? (eupStackable||b.endsWith('unstacked')) && eupQty>0 : (dinStackable||b.endsWith('unstacked')) && dinQty>0))
              .map(b => (
              <button key={b}
                className={'chip '+(seq.includes(b)?'active':'')}
                onClick={()=>{
                  setSeq(s=>{
                    const inx=s.indexOf(b);
                    if(inx>=0){ const copy=s.slice(); copy.splice(inx,1); return copy; }
                    return [...s,b];
                  });
                }}>{b}</button>
            ))}
          </div>
        </div>
        <div style={{marginTop:12}}>
          <button className="primary" onClick={compute}>Compute plan</button>
        </div>
      </div>

      <div className="card" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div>
          <h3 style={{marginTop:0}}>Plan</h3>
          <PlanSVG plan={result} width={700} height={240} />
        </div>
        <div>
          <h3 style={{marginTop:0}}>Diagnostics</h3>
          <ul>
            {warnings.map((w:string,i:number)=><li key={i} className={/door|over/i.test(w)?'warn':/overload|exceed/i.test(w)?'bad':''}>{w}</li>)}
          </ul>
          {axles && (
            <div style={{marginTop:8}}>
              <div>R_front: <b>{Math.round(axles.R_front)} kg</b></div>
              <div>R_rear: <b>{Math.round(axles.R_rear)} kg</b></div>
              <div>Peak kg/m: <b>{Math.round(axles.maxKgPerM)}</b></div>
              {(axles.warnings||[]).map((w:string,i:number)=><div key={i} className="warn">{w}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// very simple top-down visualization; replace with your row renderer when ready
function PlanSVG({plan,width,height}:{plan:any;width:number;height:number}){
  if(!plan?.placements?.length) return <div className="warn">No plan yet.</div>;
  const L=13600, W=2440;
  const sx = width/L, sy = (height-20)/W;
  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={L*sx} height={W*sy} fill="none" stroke="#334155"/>
      {plan.placements.map((p:any,i:number)=>{
        const x=p.y*sx; // length along trailer
        const y=p.x*sy; // across width (if your engine uses x/y swapped, adjust)
        const w=p.l*sx; const h=p.w*sy;
        const color = p.family==='EUP' ? '#22c55e' : '#3b82f6';
        const opacity = p.stackLevel>0 ? 0.5 : 0.9;
        return <rect key={i} x={x} y={y} width={w} height={h} fill={color} opacity={opacity} stroke="#0b1220"/>
      })}
    </svg>
  );
}
