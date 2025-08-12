'use client';
import React, { useMemo, useState } from 'react';
import { PRESETS } from '../presets';
import { FamilyInputs } from '@/components/FamilyInputs';
import { SequencePicker, type Band } from '@/components/SequencePicker';
import { planWithFixedSequence, checkAxles } from '@truck/engine';

type Family = 'EUP'|'DIN';

export default function Page() {
  // Preset
  const [presetIndex,setPresetIndex]=useState(0);
  const preset = PRESETS[presetIndex];

  // EUP state (start empty)
  const [eup,setEup] = useState({ qty:0, unitH:1200, unitW:600, stackable:false, stackableCount:0, maxStackHeight:2 });
  // DIN state
  const [din,setDin] = useState({ qty:0, unitH:1200, unitW:800, stackable:false, stackableCount:0, maxStackHeight:2 });

  // Front zone
  const [frontStagingDepth,setFrontStagingDepth]=useState(2000);

  // Fixed sequence
  const [seq,setSeq]=useState<Band[]>(['DIN_stacked','EUP_stacked','DIN_unstacked','EUP_unstacked']);

  // Visibility of bands
  const visibleBands = useMemo(()=>{
    const v = new Set<Band>();
    if (din.qty>0 && din.stackable && din.stackableCount>0) v.add('DIN_stacked');
    if (eup.qty>0 && eup.stackable && eup.stackableCount>0) v.add('EUP_stacked');
    if (din.qty>0) v.add('DIN_unstacked');
    if (eup.qty>0) v.add('EUP_unstacked');
    return v;
  },[eup,din]);

  // Items for engine
  const items = useMemo(()=>{
    const mk = (n:number,f:Family,w:number,h:number)=>Array.from({length:n},(_,i)=>({
      id:`${f}-${i}`, family:f, length:1200, width:f==='EUP'?800:1000, height:h, weight:w, qty:1, allowRotate:true
    }));
    return [...mk(eup.qty,'EUP',eup.unitW,eup.unitH), ...mk(din.qty,'DIN',din.unitW,din.unitH)];
  },[eup,din]);

  const famCfgs = useMemo(()=>[
    { family:'EUP', stackableCount: eup.stackable? Math.min(eup.qty, Math.max(0,eup.stackableCount)) : 0, maxStackHeight: eup.maxStackHeight },
    { family:'DIN', stackableCount: din.stackable? Math.min(din.qty, Math.max(0,din.stackableCount)) : 0, maxStackHeight: din.maxStackHeight },
  ],[eup,din]);

  const packOpts:any = {
    enforceRowPairConsistency: true,
    aisleReserve: 0,
    frontStagingDepth,
    blockStrategy: 'fixed',
    fixedSequence: seq
  };

  // Plan + warnings
  const [plan,setPlan]=useState<any>(null);
  const [axle,setAxle]=useState<any>(null);
  const [warnings,setWarnings]=useState<string[]>([]);

  // Capacity pre-checks (13.2 baseline)
  const baselineWarns = useMemo(()=>{
    const warns:string[]=[];
    const eupMaxNoStack = 33, dinMaxNoStack = 26;
    const eupMaxStack = 66, dinMaxStack = 52;
    const eupStacking = eup.stackable && eup.stackableCount>0 && eup.maxStackHeight>=2;
    const dinStacking = din.stackable && din.stackableCount>0 && din.maxStackHeight>=2;
    if (!eupStacking && eup.qty>eupMaxNoStack) warns.push(`EUP exceeds typical ${eupMaxNoStack} (13.2 m) without stacking.`);
    if (!dinStacking && din.qty>dinMaxNoStack) warns.push(`DIN exceeds typical ${dinMaxNoStack} (13.2 m) without stacking.`);
    if (eupStacking && eup.qty>eupMaxStack) warns.push(`EUP exceeds typical ${eupMaxStack} with stacking.`);
    if (dinStacking && din.qty>dinMaxStack) warns.push(`DIN exceeds typical ${dinMaxStack} with stacking.`);
    return warns;
  },[eup,din]);

  const canCompute = (eup.qty+din.qty) > 0;

  function compute(){
    try{
      const p = planWithFixedSequence(items as any, famCfgs as any, preset as any, packOpts);
      const a = checkAxles(p as any, preset as any, {
        linearLoadThresholdKgPerM: 2500, kingpinMinKg: 5000, kingpinMaxKg: 18000
      } as any);
      setPlan(p); setAxle(a);
      setWarnings([...(p.warnings||[]), ...baselineWarns]);
    }catch(err:any){
      setPlan(null); setAxle(null); setWarnings([String(err?.message||err)]);
    }
  }

  return (
    <main className="p-4 space-y-4">
      <section className="rounded-md border p-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm">Preset
            <select className="ml-2 border rounded px-2 py-1" value={presetIndex}
                    onChange={e=>setPresetIndex(parseInt(e.target.value,10))}>
              {PRESETS.map((p,i)=><option key={p.name} value={i}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Front stacking zone (mm)
            <input className="ml-2 border rounded px-2 py-1 w-28" type="number"
                   value={frontStagingDepth} onChange={e=>setFrontStagingDepth(parseInt(e.target.value||'0',10))}/>
          </label>
        </div>
        <FamilyInputs family="EUP" {...eup} onChange={patch=>setEup(prev=>({...prev,...patch}))}/>
        <FamilyInputs family="DIN" {...din} onChange={patch=>setDin(prev=>({...prev,...patch}))}/>
        <SequencePicker seq={seq} setSeq={setSeq} visible={visibleBands}/>
        <div>
          <button className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                  disabled={!canCompute} onClick={compute}>Compute</button>
        </div>
      </section>

      <section className="rounded-md border p-3">
        <h3 className="font-semibold">Warnings</h3>
        <ul className="list-disc pl-6 space-y-1">
          {warnings.map((w,i)=><li key={i}>{w}</li>)}
        </ul>
        {axle && (
          <div className="mt-2 text-sm">
            <div>R_front: <b>{Math.round(axle.R_front)} kg</b></div>
            <div>R_rear: <b>{Math.round(axle.R_rear)} kg</b></div>
            <div>Peak kg/m: <b>{Math.round(axle.maxKgPerM)}</b></div>
            {(axle.warnings||[]).map((w:string,i:number)=><div key={i}>{w}</div>)}
          </div>
        )}
      </section>

      {/* Keep your existing plan renderer here; no style changes required */}
    </main>
  );
}
