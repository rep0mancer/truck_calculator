import React, { useMemo, useState } from 'react';
import { planWithFixedSequence } from './planner/sequence';
import type { Item, FamilyBandConfig, PackOptions, TruckPreset, Placement } from './planner/types';

const defaultTruck: TruckPreset = {
  lengthMm: 13600,
  widthMm: 2460,
  heightMm: 2700,
};

const defaultSequence: PackOptions['fixedSequence'] = [
  'DIN_stacked', 'EUP_stacked', 'DIN_unstacked', 'EUP_unstacked',
];

function familyColor(fam: 'EUP'|'DIN'): string { return fam === 'EUP' ? '#4F46E5' : '#059669'; }

function bandLabel(band: PackOptions['fixedSequence'][number]): string {
  const [fam, kind] = band.split('_') as ['DIN'|'EUP','stacked'|'unstacked'];
  return `${fam}_${kind}`;
}

function inferFamilyFromPlacement(p: Placement): 'EUP'|'DIN' {
  const fam = (p.units?.[0]?.family ?? 'EUP') as 'EUP'|'DIN';
  return fam;
}

export function App() {
  const [items, setItems] = useState<Item[]>([
    { id: 'e1', family: 'EUP', qty: 8, heightMm: 1200, weightKg: 250 },
    { id: 'd1', family: 'DIN', qty: 6, heightMm: 1200, weightKg: 300 },
  ]);

  const [famCfg, setFamCfg] = useState<FamilyBandConfig[]>([
    { family: 'EUP', stackableCount: 0, maxStackHeight: 2 },
    { family: 'DIN', stackableCount: 0, maxStackHeight: 2 },
  ]);

  const [opts, setOpts] = useState<PackOptions>({
    enforceRowPairConsistency: true,
    aisleReserve: 0,
    frontStagingDepth: 2000,
    blockStrategy: 'fixed',
    fixedSequence: defaultSequence,
  });

  const plan = useMemo(() => {
    return planWithFixedSequence(items, famCfg, defaultTruck, opts);
  }, [items, famCfg, opts]);

  function updateStackable(family: 'EUP'|'DIN', enabled: boolean) {
    setFamCfg((prev) => prev.map(cfg => {
      if (cfg.family !== family) return cfg;
      if (!enabled) return { ...cfg, stackableCount: 0 };
      const nextCount = Math.max(1, cfg.stackableCount || 0);
      return { ...cfg, stackableCount: nextCount };
    }));
  }
  function updateStackableCount(family: 'EUP'|'DIN', count: number) {
    setFamCfg((prev) => prev.map(cfg => cfg.family === family ? { ...cfg, stackableCount: Math.max(0, Math.floor(count)) } : cfg));
  }
  function updateMaxStackHeight(family: 'EUP'|'DIN', h: number) {
    setFamCfg((prev) => prev.map(cfg => cfg.family === family ? { ...cfg, maxStackHeight: Math.max(1, Math.floor(h)) } : cfg));
  }

  function renderItemRow(family: 'EUP'|'DIN') {
    const rowItem = items.find(i => i.family === family) ?? { family, qty: 0 } as Item;
    const cfg = famCfg.find(c => c.family === family)!;
    const stackEnabled = (cfg.stackableCount ?? 0) > 0;
    const unitWeight = family === 'EUP' ? 250 : 300;
    const dims = family === 'EUP' ? '1200/800/1200' : '1200/1000/1200';

    return (
      <tr key={family}>
        <td style={{ padding: 8, fontWeight: 600 }}>{family}</td>
        <td style={{ padding: 8 }}>
          <input type="number" min={0} value={rowItem.qty}
                 onChange={(e) => setItems(prev => prev.map(it => it.family === family ? { ...it, qty: Math.max(0, parseInt(e.target.value || '0')) } : it))}
                 style={{ width: 80 }} />
        </td>
        <td style={{ padding: 8, color: '#555' }}>{dims}</td>
        <td style={{ padding: 8 }}>{unitWeight} kg</td>
        <td style={{ padding: 8 }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={stackEnabled}
                   onChange={(e) => updateStackable(family, e.target.checked)} /> Stackable?
          </label>
        </td>
        <td style={{ padding: 8 }}>
          <input type="number" disabled={!stackEnabled} min={0} value={cfg.stackableCount}
                 onChange={(e) => updateStackableCount(family, parseInt(e.target.value || '0'))}
                 style={{ width: 80 }} />
        </td>
        <td style={{ padding: 8 }}>
          <input type="number" min={1} value={cfg.maxStackHeight}
                 onChange={(e) => updateMaxStackHeight(family, parseInt(e.target.value || '1'))}
                 style={{ width: 80 }} />
        </td>
      </tr>
    );
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.dataTransfer.setData('text/plain', String(idx));
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>, dropIdx: number) {
    const dragIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(dragIdx)) return;
    setOpts(prev => {
      const next = [...prev.fixedSequence];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      return { ...prev, fixedSequence: next };
    });
  }

  const populatedBands = useMemo(() => {
    const counts = plan.bandCounts || {};
    return opts.fixedSequence.filter(b => (counts[b] ?? 0) > 0);
  }, [opts.fixedSequence, plan.bandCounts]);

  function renderSequenceChips() {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {populatedBands.map((band, idx) => (
          <div key={band}
               draggable
               onDragStart={(e) => handleDragStart(e, idx)}
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => handleDrop(e, idx)}
               title="Drag to reorder; order is saved as fixedSequence"
               style={{ padding: '6px 10px', borderRadius: 16, background: '#eee', cursor: 'grab', border: '1px solid #ddd' }}>
            {bandLabel(band)}
          </div>
        ))}
      </div>
    );
  }

  function renderFrontZoneControl() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label>Front staging depth (mm)</label>
        <input type="number" min={0} value={opts.frontStagingDepth}
               onChange={(e) => setOpts(prev => ({ ...prev, frontStagingDepth: Math.max(0, parseInt(e.target.value || '0')) }))}
               style={{ width: 120 }} />
        <span style={{ color: '#666' }} title="Stacked pallets must fit entirely in this zone; overflow is downgraded to singles.">?</span>
      </div>
    );
  }

  function renderPlanSvg() {
    const placements = plan.placements ?? [];
    const W = 800; // px
    const scaleX = W / defaultTruck.widthMm;
    const scaleY = W / defaultTruck.widthMm; // uniform scale
    const H = Math.ceil(defaultTruck.lengthMm * scaleY);

    function rectFor(p: Placement) {
      const fam = inferFamilyFromPlacement(p);
      const fill = familyColor(fam);
      const isStacked = (p.stackHeightMm ?? 0) > 0 && (p.units?.length ?? 0) > 1;
      return (
        <g key={p.idx}>
          <rect x={p.x * scaleX} y={p.y * scaleY} width={p.w * scaleX} height={p.h * scaleY}
                fill={fill} opacity={0.3} stroke={fill} />
          {isStacked && (
            <pattern id={`hatch-${p.idx}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <path d="M 0 0 L 0 6" stroke={fill} strokeWidth="2" />
            </pattern>
          )}
          {isStacked && (
            <rect x={p.x * scaleX} y={p.y * scaleY} width={p.w * scaleX} height={p.h * scaleY}
                  fill={`url(#hatch-${p.idx})`} opacity={0.5} />
          )}
        </g>
      );
    }

    return (
      <svg width={W} height={Math.min(H, 600)} viewBox={`0 0 ${W} ${H}`} style={{ border: '1px solid #ddd', background: '#fff' }}>
        <rect x={0} y={0} width={W} height={defaultTruck.lengthMm * scaleY} fill="#fafafa" />
        {/* front zone */}
        <rect x={0} y={0} width={W} height={opts.frontStagingDepth * scaleY} fill="#fde68a" opacity={0.35} />
        {(plan.placements ?? []).map(rectFor)}
      </svg>
    );
  }

  function Explain() {
    const notes = plan.notes ?? [];
    const rejected = plan.rejected ?? [];
    const groupedRejects: Record<string, number> = {};
    for (const r of rejected) {
      const fam = r.item.family;
      const key = `${fam}:${r.reason}`;
      groupedRejects[key] = (groupedRejects[key] ?? 0) + 1;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <strong>Rejections</strong>
          <ul>
            {Object.entries(groupedRejects).length === 0 && <li>None</li>}
            {Object.entries(groupedRejects).map(([k, v]) => (
              <li key={k}>{k} = {v}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Warnings</strong>
          <ul>
            {notes.length === 0 && <li>None</li>}
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', padding: 24, display: 'grid', gap: 24 }}>
      <h1>Truck Planner</h1>

      <div>
        <h3>Items</h3>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Family</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Qty</th>
              <th style={{ textAlign: 'left', padding: 8 }}>L/W/H (mm)</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Unit Weight</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Stackable?</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Stackable count</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Max stack height</th>
            </tr>
          </thead>
          <tbody>
            {renderItemRow('EUP')}
            {renderItemRow('DIN')}
          </tbody>
        </table>
      </div>

      <div>
        <h3>Sequence</h3>
        {renderSequenceChips()}
        <div style={{ marginTop: 8, color: '#666' }}>Default: [DIN_stacked, EUP_stacked, DIN_unstacked, EUP_unstacked]</div>
      </div>

      <div>
        <h3>Front zone</h3>
        {renderFrontZoneControl()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Plan preview</h3>
          {renderPlanSvg()}
        </div>
        <div>
          <h3>Explain</h3>
          <Explain />
        </div>
      </div>

      <div style={{ color: '#666' }}>
        <div><strong>Sequence used:</strong> {(plan.sequenceUsed ?? []).join(' → ') || '—'}</div>
      </div>
    </div>
  );
}