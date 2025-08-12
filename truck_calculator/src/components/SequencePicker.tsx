'use client';
import React from 'react';
export type Band = 'DIN_stacked'|'EUP_stacked'|'DIN_unstacked'|'EUP_unstacked';

export function SequencePicker({ seq, setSeq, visible }: {
  seq: Band[]; setSeq:(b:Band[])=>void; visible: Set<Band>;
}) {
  const ALL: Band[] = ['DIN_stacked','EUP_stacked','DIN_unstacked','EUP_unstacked'];
  const chips = ALL.filter(b => visible.has(b));
  const move = (b:Band, dir:-1|1) => {
    const i = seq.indexOf(b); if (i<0) return;
    const j = Math.max(0, Math.min(seq.length-1, i+dir));
    const copy = seq.slice(); [copy[i],copy[j]] = [copy[j],copy[i]]; setSeq(copy);
  };
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Sequence</div>
      <div className="flex flex-wrap gap-2">
        {chips.map(b=>(
          <div key={b} className="flex items-center gap-1">
            <span className="px-3 py-1 rounded-full border text-blue-600 border-blue-600">{b}</span>
            <div className="flex flex-col gap-1">
              <button type="button" className="px-2 border rounded" onClick={()=>move(b,-1)}>↑</button>
              <button type="button" className="px-2 border rounded" onClick={()=>move(b, 1)}>↓</button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-70">Rule: stacked bands must stay in the front zone only.</p>
    </div>
  );
}