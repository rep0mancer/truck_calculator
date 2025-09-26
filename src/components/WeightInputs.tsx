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
      <div className="flex items-center gap-2 mb-1">
        <label className="w-20 text-center text-xs text-gray-600">Anzahl</label>
        <label className="w-32 text-center text-xs text-gray-600">Gewicht/{palletType} (kg)</label>
      </div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
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
              className="w-16 text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
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
            className="w-32 text-center"
          />
          {entries.length > 1 && (
            <Button onClick={() => handleRemoveEntry(entry.id)} variant="destructive" size="sm">
              -
            </Button>
          )}
        </div>
      ))}
      <Button onClick={handleAddEntry} className="mt-2" size="sm">
        Gewichtsgruppe hinzufügen
      </Button>
    </div>
  );
}
