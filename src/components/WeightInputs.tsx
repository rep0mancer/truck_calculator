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
  preferredId?: number | null;
  onSetPreferred?: (id: number | null) => void;
  groupName?: string;
}

export function WeightInputs({ entries, onChange, palletType }: Omit<WeightInputsProps, 'preferredId' | 'onSetPreferred' | 'groupName'>) {
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
        <label className="w-20 text-center text-xs text-slate-600">Anzahl</label>
        <label className="w-32 text-center text-xs text-slate-600">Gewicht/{palletType} (kg)</label>
      </div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2 rounded-full bg-white/20 border-white/30 hover:bg-white/25 hover:border-white/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:transform hover:translateY-[-1px] hover:shadow-md"
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
              className="w-16 text-center bg-white/20 border-white/30 rounded-xl backdrop-blur-md shadow-sm focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2 rounded-full bg-white/20 border-white/30 hover:bg-white/25 hover:border-white/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:transform hover:translateY-[-1px] hover:shadow-md"
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
            className="w-32 text-center bg-white/20 border-white/30 rounded-xl backdrop-blur-md shadow-sm focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300"
          />
          {entries.length > 1 && (
            <Button onClick={() => handleRemoveEntry(entry.id)} variant="destructive" size="sm" className="rounded-full bg-red-500/15 border-red-500/30 hover:bg-red-500/25 hover:border-red-500/40 text-red-700 backdrop-blur-md shadow-sm transition-all duration-300 hover:transform hover:translateY-[-1px] hover:shadow-md">
              -
            </Button>
          )}
        </div>
      ))}
      <Button onClick={handleAddEntry} className="mt-2 rounded-full bg-green-500/15 border-green-500/35 hover:bg-green-500/22 hover:border-green-500/45 text-green-800 backdrop-blur-md shadow-sm transition-all duration-300 hover:transform hover:translateY-[-1px] hover:shadow-md" size="sm">
        Gewichtsgruppe hinzufügen
      </Button>
    </div>
  );
}
