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
  preferredId: number | null;
  onSetPreferred: (id: number | null) => void;
  groupName: string;
}

export function WeightInputs({ entries, onChange, palletType, preferredId, onSetPreferred }: WeightInputsProps) {
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600/80">
        <span className="w-20 text-center">Anzahl</span>
        <span className="w-32 text-center">Gewicht/{palletType} (kg)</span>
      </div>
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 mt-1 rounded-2xl rounded-md">
          <div className="flex items-center gap-2 rounded-2xl rounded-md">
            <button
              type="button"
              aria-label="Menge verringern"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold leading-none drop-shadow-[0_12px_24px_rgba(15,23,42,0.28)]"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="w-20 text-center font-semibold tracking-wide"
            />
            <button
              type="button"
              aria-label="Menge erhöhen"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold leading-none drop-shadow-[0_12px_24px_rgba(15,23,42,0.28)]"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
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
            className="w-32 text-center font-semibold tracking-wide"
          />
          {entries.length > 1 && (
            <button
              type="button"
              aria-label="Eintrag entfernen"
              onClick={() => handleRemoveEntry(entry.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold leading-none drop-shadow-[0_12px_24px_rgba(239,68,68,0.35)]"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddEntry}
        className="mt-4 w-full rounded-full py-2 text-sm font-semibold uppercase tracking-[0.2em] drop-shadow-[0_16px_30px_rgba(59,130,246,0.35)]"
      >
        Gewichtsgruppe hinzufügen
      </button>
    </div>
  );
}
