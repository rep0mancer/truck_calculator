'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import type { WeightEntry } from '@/lib/loading/logic';

interface WeightInputsProps {
  entries: WeightEntry[];
  onChange: (entries: WeightEntry[]) => void;
  palletType: 'EUP' | 'DIN';
  preferredId?: number | null;
  onSetPreferred?: (id: number | null) => void;
  groupName?: string;
  stackableEnabled?: boolean;
}

export function WeightInputs({ entries, onChange, palletType, preferredId = null, onSetPreferred, stackableEnabled = false }: WeightInputsProps) {
  const handleAddEntry = () => {
    onChange([...entries, { id: Date.now(), weight: '', quantity: 0, stackable: false }]);
  };

  const handleRemoveEntry = (id: number) => {
    // If the removed entry was the preferred one, reset the preference
    if (id === preferredId && onSetPreferred) {
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
        if (newQuantity === 0 && id === preferredId && onSetPreferred) {
            onSetPreferred(null);
        }
        return { ...entry, quantity: newQuantity, weight: newWeight };
      }
      return entry;
    });
    onChange(newEntries);
  };

  const handleStackableToggle = (id: number, checked: boolean) => {
    const newEntries = entries.map(entry => entry.id === id ? { ...entry, stackable: checked } : entry);
    onChange(newEntries);
  };
  
  


  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="w-20 text-center text-xs font-semibold text-slate-600">Anzahl</label>
        <label className="w-32 text-center text-xs font-semibold text-slate-600">Gewicht/{palletType} (kg)</label>
        {stackableEnabled && (
          <span className="text-xs font-semibold text-slate-600">Stapelbar</span>
        )}
      </div>
      {entries.map(entry => (
        <div key={entry.id} className="flex items-center gap-3 mt-2 rounded-2xl border border-white/30 bg-white/10 px-3 py-2 backdrop-blur-xl shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
              aria-label="Menge reduzieren"
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="w-16 text-center font-semibold"
            />
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
              aria-label="Menge erhöhen"
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
            className="w-32 text-center font-semibold"
          />
          <div className="flex items-center gap-2">
            {stackableEnabled && (
              <label className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(entry.stackable)}
                  onChange={(e) => handleStackableToggle(entry.id, e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            )}
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveEntry(entry.id)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
                aria-label="Gruppe entfernen"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      <button onClick={handleAddEntry} className="mt-3 w-full py-2 text-sm font-semibold tracking-wide rounded-2xl">
        Gewichtsgruppe hinzufügen
      </button>
    </div>
  );
}
