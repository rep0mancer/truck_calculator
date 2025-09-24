// src/components/WeightInputs.tsx
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
        return { ...entry, [field]: field === 'quantity' ? parseInt(value, 10) || 0 : value };
      }
      return entry;
    });
    onChange(newEntries);
  };

  return (
    <div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-2 mt-2">
          <Input
            type="number"
            value={entry.quantity}
            onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
            placeholder="Qty"
            className="w-20"
          />
          <Input
            type="number"
            value={entry.weight}
            onChange={(e) => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`Weight/${palletType} (kg)`}
            className="w-32"
          />
          {index > 0 && (
            <Button onClick={() => handleRemoveEntry(entry.id)} variant="destructive" size="sm">
              -
            </Button>
          )}
        </div>
      ))}
      <Button onClick={handleAddEntry} className="mt-2" size="sm">
        Add Weight Group
      </Button>
    </div>
  );
}
