'use client';

import React from 'react';

type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
};

interface WeightInputsProps {
  entries: WeightEntry[];
  onChange: (entries: WeightEntry[]) => void;
  palletType: 'EUP' | 'DIN';
}

export function WeightInputs({ entries, onChange, palletType }: WeightInputsProps) {
  const handleAddEntry = () => {
    onChange([...entries, { id: Date.now(), weight: '', quantity: 0 }]);
  };

  const handleRemoveEntry = (id: number) => {
    onChange(entries.filter(entry => entry.id !== id));
  };

  const handleEntryChange = (id: number, field: 'weight' | 'quantity', value: string) => {
    const newEntries = entries.map(entry => {
      if (entry.id === id) {
        const newQuantity = field === 'quantity' ? parseInt(value, 10) || 0 : entry.quantity;
        const newWeight = field === 'weight' ? value : entry.weight;
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
            <button
              type="button"
              className="px-2"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
            >
              -
            </button>
            <input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="w-16 text-center"
            />
            <button
              type="button"
              className="px-2"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
            >
              +
            </button>
          </div>
          <input
            type="number"
            min="0"
            value={entry.weight}
            onChange={(e) => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`Gewicht/${palletType}`}
            className="w-32 text-center"
          />
          {entries.length > 1 && (
            <button onClick={() => handleRemoveEntry(entry.id)} className="bg-destructive px-2 py-1 text-xs">
              -
            </button>
          )}
        </div>
      ))}
      <button onClick={handleAddEntry} className="mt-2 text-sm">
        Gewichtsgruppe hinzufügen
      </button>
    </div>
  );
}
