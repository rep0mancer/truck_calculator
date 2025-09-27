'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
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
    <div>
      <div className="flex items-center gap-3 mb-2 text-xs text-[var(--text-2)]">
        <span className="w-20 text-center">Anzahl</span>
        <span className="w-32 text-center">Gewicht/{palletType} (kg)</span>
      </div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="stepper-btn flex items-center justify-center text-lg"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
            >
              -
            </Button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="input-dark h-10 px-3 text-right w-full max-w-[4.5rem]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="stepper-btn flex items-center justify-center text-lg"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
            >
              +
            </Button>
          </div>
          <Input
            type="number"
            min="0"
            value={entry.weight}
            onChange={(e) => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`Gewicht/${palletType}`}
            className="input-dark h-10 px-3 text-right w-full max-w-[6.5rem]"
          />
          {entries.length > 1 && (
            <Button onClick={() => handleRemoveEntry(entry.id)} variant="destructive" size="sm" className="h-10 w-10 rounded-full">
              -
            </Button>
          )}
        </div>
      ))}
      <Button onClick={handleAddEntry} className="mt-3 btn-ghost px-4 py-2 text-sm font-medium" size="sm">
        Gewichtsgruppe hinzufügen
      </Button>
    </div>
  );
}
