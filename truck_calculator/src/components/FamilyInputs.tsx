'use client';
import React from 'react';
type Family = 'EUP'|'DIN';

export function FamilyInputs({
  family, qty, unitH, unitW, stackable, stackableCount, maxStackHeight, onChange
}: {
  family: Family; qty: number; unitH: number; unitW: number;
  stackable: boolean; stackableCount: number; maxStackHeight: number;
  onChange: (patch: Partial<Record<string, number|boolean>>) => void;
}) {
  const L = 1200, W = family==='EUP' ? 800 : 1000;
  return (
    <fieldset className="rounded-md border p-3 space-y-2">
      <legend className="text-sm font-semibold">{family}</legend>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-xs">
          Quantity
          <div className="flex gap-2">
            <button type="button" onClick={()=>onChange({qty: Math.max(0, qty-1)})} className="px-2 border rounded">-</button>
            <input value={qty} onChange={e=>onChange({qty: Math.max(0,parseInt(e.target.value||'0',10))})}
                   className="px-2 py-1 border rounded w-20" type="number"/>
            <button type="button" onClick={()=>onChange({qty: qty+1})} className="px-2 border rounded">+</button>
          </div>
        </label>
        <label className="text-xs">Unit L×W (mm)
          <div className="flex gap-2">
            <input value={L} readOnly className="px-2 py-1 border rounded w-20 opacity-70"/>
            <input value={W} readOnly className="px-2 py-1 border rounded w-20 opacity-70"/>
          </div>
        </label>
        <label className="text-xs">Unit height (mm)
          <input value={unitH} onChange={e=>onChange({unitH: Math.max(0,parseInt(e.target.value||'0',10))})}
                 className="px-2 py-1 border rounded w-28" type="number"/>
        </label>
        <label className="text-xs">Unit weight (kg)
          <input value={unitW} onChange={e=>onChange({unitW: Math.max(0,parseInt(e.target.value||'0',10))})}
                 className="px-2 py-1 border rounded w-28" type="number"/>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={stackable} onChange={e=>onChange({stackable: e.target.checked})}/>
          <span className="text-sm">Stackable</span>
        </label>
        {stackable && (
          <>
            <label className="text-xs">Stackable count
              <input value={stackableCount} onChange={e=>onChange({stackableCount: Math.max(0,parseInt(e.target.value||'0',10))})}
                     className="px-2 py-1 border rounded w-28" type="number"/>
            </label>
            <label className="text-xs">Max stack height
              <input value={maxStackHeight} onChange={e=>onChange({maxStackHeight: Math.max(1,parseInt(e.target.value||'1',10))})}
                     className="px-2 py-1 border rounded w-28" type="number"/>
            </label>
          </>
        )}
      </div>
    </fieldset>
  );
}