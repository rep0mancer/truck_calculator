// src/bands.ts
function getFamilyConfig(famCfgs, family) {
  const found = famCfgs.find((c) => c.family === family);
  return found ?? { family, stackableCount: 0, maxStackHeight: 2 };
}
function expandUnits(items) {
  const units = [];
  for (const item of items) {
    const qty = Math.max(1, Number(item.qty ?? 1));
    for (let i = 0; i < qty; i += 1) {
      units.push({ ...item, qty: 1 });
    }
  }
  return units;
}
function splitIntoBands(allItems, famCfgs) {
  const units = expandUnits(allItems);
  const eupCfg = getFamilyConfig(famCfgs, "EUP");
  const dinCfg = getFamilyConfig(famCfgs, "DIN");
  const EUP_units = units.filter((u) => u.family === "EUP");
  const DIN_units = units.filter((u) => u.family === "DIN");
  const EUP_stacked = [];
  const EUP_unstacked = [];
  const DIN_stacked = [];
  const DIN_unstacked = [];
  for (let i = 0; i < EUP_units.length; i += 1) {
    if (i < eupCfg.stackableCount) EUP_stacked.push(EUP_units[i]);
    else EUP_unstacked.push(EUP_units[i]);
  }
  for (let i = 0; i < DIN_units.length; i += 1) {
    if (i < dinCfg.stackableCount) DIN_stacked.push(DIN_units[i]);
    else DIN_unstacked.push(DIN_units[i]);
  }
  return { EUP_stacked, EUP_unstacked, DIN_stacked, DIN_unstacked };
}

// src/stacking.ts
function sumNumber(values) {
  let total = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }
  return total;
}
function makeColumn(units) {
  const family = units[0]?.family ?? "EUP";
  const height = sumNumber(units.map((u) => u.heightMm));
  const weight = sumNumber(units.map((u) => u.weightKg));
  return { units, height, weight, family };
}
function formColumns(units, maxStackHeight) {
  if (maxStackHeight <= 1) {
    return { columns: [], singles: [...units] };
  }
  const columns = [];
  const singles = [];
  let buffer = [];
  for (const unit of units) {
    buffer.push(unit);
    if (buffer.length === maxStackHeight) {
      columns.push(makeColumn(buffer));
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    singles.push(...buffer);
  }
  return { columns, singles };
}
function getMaxStackHeightForFamily(famCfgs, family) {
  const cfg = famCfgs.find((c) => c.family === family);
  return cfg?.maxStackHeight ?? 2;
}
function buildStackedBands(bands, famCfgs) {
  const eupMax = getMaxStackHeightForFamily(famCfgs, "EUP");
  const dinMax = getMaxStackHeightForFamily(famCfgs, "DIN");
  const { columns: EUP_columns, singles: EUP_singles } = formColumns(bands.EUP_stacked, eupMax);
  const { columns: DIN_columns, singles: DIN_singles } = formColumns(bands.DIN_stacked, dinMax);
  return { EUP_columns, DIN_columns, EUP_singles, DIN_singles };
}
function computeRowDepthByFamily(_preset, _opts) {
  const baseDepthMm = 1200;
  const clearanceMm = 0;
  return { EUP: baseDepthMm + clearanceMm, DIN: baseDepthMm + clearanceMm };
}
function applyFrontZoneDowngrade(stacked, preset, opts, rowDepthByFamily) {
  const warnings = [];
  let downgradedCount = 0;
  function trimForFamily(columns, family) {
    const rowDepth = Math.max(1, Math.floor(rowDepthByFamily[family]));
    const rowsFit = Math.max(0, Math.floor(opts.frontStagingDepth / rowDepth));
    if (columns.length <= rowsFit) {
      return { kept: columns, removed: [], downgradedUnits: [] };
    }
    const kept = columns.slice(0, rowsFit);
    const removed = columns.slice(rowsFit);
    const downgradedUnits = removed.flatMap((c) => c.units);
    return { kept, removed, downgradedUnits };
  }
  const eupTrim = trimForFamily(stacked.EUP_columns, "EUP");
  if (eupTrim.removed.length > 0) {
    const count = eupTrim.downgradedUnits.length;
    downgradedCount += count;
    warnings.push(`Stacked EUP: downgraded ${count} units; front zone capacity exceeded.`);
  }
  const dinTrim = trimForFamily(stacked.DIN_columns, "DIN");
  if (dinTrim.removed.length > 0) {
    const count = dinTrim.downgradedUnits.length;
    downgradedCount += count;
    warnings.push(`Stacked DIN: downgraded ${count} units; front zone capacity exceeded.`);
  }
  const updated = {
    EUP_columns: eupTrim.kept,
    DIN_columns: dinTrim.kept,
    EUP_singles: stacked.EUP_singles,
    // leftover from stacked band stays here; caller will append downgraded to unstacked bands
    DIN_singles: stacked.DIN_singles
  };
  return {
    stacked: updated,
    downgradedCount,
    warnings,
    downgraded: { EUP: eupTrim.downgradedUnits, DIN: dinTrim.downgradedUnits }
  };
}

// src/packer.ts
function getFamilyWidthMm(f) {
  return f === "EUP" ? 800 : 1e3;
}
function getFamilyDepthMm(f) {
  return 1200;
}
function getUnitWeight(u) {
  if (u.weight != null) return u.weight;
  const w = u.weightKg;
  return typeof w === "number" && Number.isFinite(w) ? w : 0;
}
function buildRowsForBand(kind, prepared) {
  const family = kind.includes("EUP") ? "EUP" : "DIN";
  const depth = getFamilyDepthMm(family);
  let pool = [];
  if (kind === "EUP_stacked") pool = [...prepared.EUP_columns];
  if (kind === "DIN_stacked") pool = [...prepared.DIN_columns];
  if (kind === "EUP_unstacked") pool = [...prepared.unstacked_EUP, ...prepared.EUP_singles];
  if (kind === "DIN_unstacked") pool = [...prepared.unstacked_DIN, ...prepared.DIN_singles];
  const rows = [];
  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i];
    const b = pool[i + 1];
    if (!b) {
      rows.push({ family, items: [a], weight: getUnitWeight(a), depthMm: depth });
      break;
    }
    const rowItems = [a, b];
    const weight = getUnitWeight(a) + getUnitWeight(b);
    rows.push({ family, items: rowItems, weight, depthMm: depth });
  }
  return rows;
}
function deriveUnitsAndHeight(u) {
  if (u.units && u.height != null) {
    const col = u;
    return { units: [...col.units], heightMm: Math.max(0, Math.floor(col.height)) };
  }
  const item = u;
  const h = item.heightMm;
  const heightMm = typeof h === "number" && Number.isFinite(h) ? Math.max(0, Math.floor(h)) : 0;
  return { units: [item], heightMm };
}
function packBandSequence(seq, prepared, preset, opts) {
  const placements = [];
  const rejected = [];
  const notes = [];
  let yCursor = 0;
  const widthMm = preset.widthMm;
  const lengthMm = preset.lengthMm;
  const aisleReserve = Math.max(0, Math.floor(opts.aisleReserve ?? 0));
  const usableLength = Math.max(0, lengthMm - aisleReserve);
  const sequenceUsed = [];
  const bandCounts = {};
  for (const band of seq) {
    const rows = buildRowsForBand(band, prepared);
    const countInBand = rows.reduce((acc, r) => acc + (r.items.length >= 2 ? 2 : 1), 0);
    bandCounts[band] = countInBand;
    if (countInBand === 0) continue;
    const fullRows = rows.filter((r) => r.items.length === 2);
    const orphan = rows.find((r) => r.items.length === 1);
    fullRows.sort((a, b) => b.weight - a.weight);
    const family = band.includes("EUP") ? "EUP" : "DIN";
    const rowDepth = getFamilyDepthMm(family);
    const rowWidth = getFamilyWidthMm(family) * 2;
    if (rowWidth > widthMm) {
      notes.push(`Row width ${rowWidth} exceeds truck width ${widthMm} for ${family}.`);
      for (const r of fullRows) {
        for (const u of r.items) rejected.push({ item: u, reason: "row-width" });
      }
      if (orphan) rejected.push({ item: orphan.items[0], reason: "row-width" });
      continue;
    }
    let placedAny = false;
    for (const row of fullRows) {
      if (yCursor + rowDepth > usableLength) {
        for (const r of fullRows.slice(fullRows.indexOf(row))) {
          for (const u of r.items) rejected.push({ item: u, reason: opts.enforceRowPairConsistency ? "pair-consistency" : "length" });
        }
        if (orphan) rejected.push({ item: orphan.items[0], reason: opts.enforceRowPairConsistency ? "pair-consistency" : "length" });
        break;
      }
      const slotW = getFamilyWidthMm(row.family);
      const xLeft = Math.floor((widthMm - slotW * 2) / 2);
      const leftMeta = deriveUnitsAndHeight(row.items[0]);
      const rightMeta = deriveUnitsAndHeight(row.items[1]);
      placements.push({ x: xLeft, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length, z: 0, stackHeightMm: leftMeta.heightMm, units: leftMeta.units });
      placements.push({ x: xLeft + slotW, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length, z: 0, stackHeightMm: rightMeta.heightMm, units: rightMeta.units });
      yCursor += rowDepth;
      placedAny = true;
    }
    if (orphan) {
      if (yCursor + rowDepth <= usableLength) {
        const laterBandExists = seq.slice(seq.indexOf(band) + 1).some((b) => b.includes(orphan.family));
        if (!laterBandExists || !opts.enforceRowPairConsistency) {
          rejected.push({ item: orphan.items[0], reason: "pair-consistency" });
        } else {
          notes.push(`Carried forward orphan ${orphan.family} unit for pairing in later band.`);
          if (orphan.family === "EUP") prepared.unstacked_EUP.unshift(orphan.items[0]);
          else prepared.unstacked_DIN.unshift(orphan.items[0]);
        }
      } else {
        rejected.push({ item: orphan.items[0], reason: "pair-consistency" });
      }
    }
    if (placedAny) sequenceUsed.push(band);
  }
  const usedLengthMm = yCursor;
  const result = {
    sequenceUsed,
    bandCounts,
    placements,
    rejected,
    notes: [
      "Packed bands front-to-back with pair-consistent two-across rows and heavy-forward bias.",
      `Aisle reserve ${aisleReserve}mm respected at rear.`
    ],
    usedLengthMm,
    usedWidthMm: widthMm,
    usedHeightMm: preset.heightMm
  };
  return result;
}

// src/height.ts
function getSideDoorHeight(preset) {
  const v = preset.sideDoorHeight;
  const n = typeof v === "number" && Number.isFinite(v) ? v : void 0;
  return n ?? 2650;
}
function getPlacementTop(placement) {
  const z = typeof placement.z === "number" ? placement.z : 0;
  const height = typeof placement.stackHeightMm === "number" ? placement.stackHeightMm : 0;
  return z + height;
}
function applyHeightChecks(plan, preset) {
  const sideDoorHeight = getSideDoorHeight(preset);
  const innerHeight = preset.innerHeight ?? preset.heightMm ?? 0;
  const warnings = [...plan.warnings ?? []];
  const notes = [...plan.notes ?? []];
  const rejected = [...plan.rejected ?? []];
  const placements = plan.placements ?? [];
  const byXY = /* @__PURE__ */ new Map();
  for (const p of placements) {
    const top = getPlacementTop(p);
    const key = `${p.x},${p.y}`;
    const prev = byXY.get(key);
    if (!prev || top > prev.top) {
      byXY.set(key, { top, x: p.x, y: p.y, idx: p.idx });
    }
    if (innerHeight && top > innerHeight) {
      const units = Array.isArray(p.units) ? p.units : [];
      if (units.length > 0) {
        for (const u of units) rejected.push({ item: u, reason: "overheight" });
      } else {
        rejected.push({
          item: { family: "EUP", qty: 1, id: `overheight@${p.x},${p.y}` },
          reason: "overheight"
        });
      }
    }
  }
  for (const entry of byXY.values()) {
    if (entry.top > sideDoorHeight) {
      warnings.push(
        `Side-door height risk at approx x=${entry.x}mm, y=${entry.y}mm: ${Math.round(entry.top)}mm exceeds ${sideDoorHeight}mm.`
      );
    }
  }
  return {
    ...plan,
    warnings,
    notes,
    rejected
  };
}

// src/sequence.ts
function planWithFixedSequence(items, famCfgs, preset, opts) {
  const unitBands = splitIntoBands(items, famCfgs);
  const stacked = buildStackedBands(unitBands, famCfgs);
  const rowDepthByFamily = computeRowDepthByFamily(preset, opts);
  const downgrade = applyFrontZoneDowngrade(stacked, preset, opts, rowDepthByFamily);
  const prepared = {
    EUP_columns: downgrade.stacked.EUP_columns,
    DIN_columns: downgrade.stacked.DIN_columns,
    EUP_singles: downgrade.stacked.EUP_singles,
    DIN_singles: downgrade.stacked.DIN_singles,
    // unstacked pools from original unstacked items plus downgraded overflow
    unstacked_EUP: [
      ...unitBands.EUP_unstacked,
      ...downgrade.downgraded.EUP
    ],
    unstacked_DIN: [
      ...unitBands.DIN_unstacked,
      ...downgrade.downgraded.DIN
    ]
  };
  const packed = packBandSequence(opts.fixedSequence, prepared, preset, opts);
  const notes = [
    ...packed.notes ?? [],
    ...downgrade.warnings
  ];
  const withHeight = applyHeightChecks({ ...packed, notes }, preset);
  return {
    ...withHeight
  };
}

// src/axles.ts
function getPlacementCentroidY(p) {
  const y = typeof p.y === "number" ? p.y : 0;
  const h = typeof p.h === "number" ? p.h : 0;
  return y + h / 2;
}
function sumPlacementWeightKg(p) {
  const units = p.units ?? [];
  let total = 0;
  for (const u of units) {
    const w = u.weightKg;
    if (typeof w === "number" && Number.isFinite(w)) total += w;
  }
  return total;
}
function checkAxles(plan, _preset, opts) {
  const placements = Array.isArray(plan.placements) ? plan.placements : [];
  const perSlotWeightKg = Math.max(0, Math.floor(opts.perSlotWeightKg ?? 0));
  const binSizeMm = Math.max(1, Math.floor(opts.binSizeMm ?? 1e3));
  const binToKg = /* @__PURE__ */ new Map();
  let totalWeightKg = 0;
  for (const p of placements) {
    const centroid = getPlacementCentroidY(p);
    const bin = Math.floor(centroid / binSizeMm);
    const unitSum = sumPlacementWeightKg(p);
    const w = unitSum > 0 ? unitSum : perSlotWeightKg;
    totalWeightKg += w;
    binToKg.set(bin, (binToKg.get(bin) ?? 0) + w);
  }
  const maxBinKg = Math.max(0, ...binToKg.values());
  const maxKgPerM = maxBinKg * 1e3 / binSizeMm;
  const warnings = [];
  if (opts.maxKgPerM != null && maxKgPerM > opts.maxKgPerM) {
    warnings.push(`Peak linear density ${Math.round(maxKgPerM)} kg/m exceeds threshold ${opts.maxKgPerM} kg/m.`);
  }
  const supportFrontX = Math.max(0, Math.floor(opts.supportFrontX));
  const supportRearX = Math.max(supportFrontX + 1, Math.floor(opts.supportRearX));
  const L = supportRearX - supportFrontX;
  let R_front = 0;
  let R_rear = 0;
  for (const p of placements) {
    const x = getPlacementCentroidY(p);
    const xi = Math.max(supportFrontX, Math.min(supportRearX, x));
    const unitSum = sumPlacementWeightKg(p);
    const w = unitSum > 0 ? unitSum : perSlotWeightKg;
    const a = (supportRearX - xi) / L;
    const b = (xi - supportFrontX) / L;
    R_front += w * a;
    R_rear += w * b;
  }
  if (opts.rearAxleGroupMaxKg != null && R_rear > opts.rearAxleGroupMaxKg) {
    warnings.push(`Rear axle group load ${Math.round(R_rear)} kg exceeds ${opts.rearAxleGroupMaxKg} kg.`);
  }
  if (opts.kingpinMinKg != null && R_front < opts.kingpinMinKg) {
    warnings.push(`Front support (kingpin) load ${Math.round(R_front)} kg below minimum ${opts.kingpinMinKg} kg.`);
  }
  if (opts.kingpinMaxKg != null && R_front > opts.kingpinMaxKg) {
    warnings.push(`Front support (kingpin) load ${Math.round(R_front)} kg exceeds ${opts.kingpinMaxKg} kg.`);
  }
  if (opts.payloadMaxKg != null && totalWeightKg > opts.payloadMaxKg) {
    warnings.push(`Total payload ${Math.round(totalWeightKg)} kg exceeds ${opts.payloadMaxKg} kg.`);
  }
  return {
    R_front: Math.round(R_front),
    R_rear: Math.round(R_rear),
    maxKgPerM: Math.round(maxKgPerM),
    warnings
  };
}
export {
  applyFrontZoneDowngrade,
  applyHeightChecks,
  buildStackedBands,
  checkAxles,
  computeRowDepthByFamily,
  expandUnits,
  formColumns,
  packBandSequence,
  planWithFixedSequence,
  splitIntoBands
};
