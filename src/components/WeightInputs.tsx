'use client';

import React from 'react';
import { Input } from '@/components/ui/input';

type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
};

interface WeightInputsProps {
  entries: WeightEntry[];
  onChange: (entries: WeightEntry[]) => void;
  palletType: 'EUP' | 'DIN';
  preferredId?: number | null;
  onSetPreferred?: (id: number | null) => void;
  groupName?: string;
}

export function WeightInputs({ entries, onChange, palletType, preferredId = null, onSetPreferred = () => {} }: WeightInputsProps) {
  const handleAddEntry = () => {
    onChange([...entries, { id: Date.now(), weight: '', quantity: 0 }]);
  };

  const handleRemoveEntry = (id: number) => {
    // If the removed entry was the preferred one, reset the preference
    if (id === preferredId) {
      onSetPreferred(null);
    }
    onChange(entries.filter(entry => entry.id !== id));
  };

  const handleEntryChange = (id: number, field: 'weight' | 'quantity', value: string) => {
    const newEntries = entries.map(entry => {
      if (entry.id === id) {
        const newQuantity = field === 'quantity' ? parseInt(value, 10) || 0 : entry.quantity;
        const newWeight = field === 'weight' ? value : entry.weight;
        // If quantity is set to 0, and it's the preferred item, reset preference
        if (newQuantity === 0 && id === preferredId) {
            onSetPreferred(null);
        }
        return { ...entry, quantity: newQuantity, weight: newWeight };
      }
      return entry;
    });
    onChange(newEntries);
  };
  
  


  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-600/90">
        <span className="w-20 text-center">Anzahl</span>
        <span className="w-32 text-center">Gewicht/{palletType} (kg)</span>
      </div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
              className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-emerald-900/90"
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="w-20 text-center text-sm font-semibold tracking-wide text-slate-900"
            />
            <button
              type="button"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
              className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-emerald-900/90"
            >
              +
            </button>
          </div>
          <Input
            type="number"
            min="0"
            value={entry.weight}
            onChange={(e) => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`Gewicht/${palletType}`}
            className="w-36 text-center text-sm font-semibold tracking-wide text-slate-900"
          />
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveEntry(entry.id)}
              className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-rose-900/90"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button onClick={handleAddEntry} className="mt-3 w-full rounded-xl py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/90">
        Gewichtsgruppe hinzufügen
      </button>
    </div>
  );
}
