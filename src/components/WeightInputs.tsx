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

export function WeightInputs({ entries, onChange, palletType, preferredId, onSetPreferred }: WeightInputsProps) {
  const accentColor = palletType === 'DIN' ? 'var(--accent-din)' : 'var(--accent-eup)';
  const focusOutline = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-0 focus-visible:ring-offset-0';

  const handleAddEntry = () => {
    onChange([...entries, { id: Date.now(), weight: '', quantity: 0 }]);
  };

  const handleRemoveEntry = (id: number) => {
    // If the removed entry was the preferred one, reset the preference
    if (id === preferredId) {
      onSetPreferred?.(null);
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
            onSetPreferred?.(null);
        }
        return { ...entry, quantity: newQuantity, weight: newWeight };
      }
      return entry;
    });
    onChange(newEntries);
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3 text-xs font-medium text-[var(--text-muted)]">
        <span>Anzahl</span>
        <span className="justify-self-start">Gewicht/{palletType}</span>
        <span className="sr-only">Aktionen</span>
      </div>
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`${focusOutline} h-8 w-8 border border-[var(--border)] text-[var(--text)]`}
              style={{ outlineColor: accentColor }}
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
              aria-label="Menge verringern"
            >
              −
            </Button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={e => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="0"
              className={`${focusOutline} h-8 w-full text-right text-sm`}
              style={{ outlineColor: accentColor }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`${focusOutline} h-8 w-8 border border-[var(--border)] text-[var(--text)]`}
              style={{ outlineColor: accentColor }}
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
              aria-label="Menge erhöhen"
            >
              +
            </Button>
          </div>
          <div className="relative flex items-center">
            <Input
              type="number"
              min="0"
              value={entry.weight}
              onChange={e => handleEntryChange(entry.id, 'weight', e.target.value)}
              placeholder="0"
              className={`${focusOutline} h-8 w-full pr-10 text-right text-sm`}
              style={{ outlineColor: accentColor }}
              aria-describedby={`weight-unit-${palletType}-${entry.id}`}
            />
            <span
              id={`weight-unit-${palletType}-${entry.id}`}
              className="pointer-events-none absolute right-3 text-xs text-[var(--text-muted)]"
            >
              kg
            </span>
          </div>
          <div className="flex justify-end">
            {entries.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleRemoveEntry(entry.id)}
                className={`${focusOutline} h-8 w-8 border border-[var(--border)] text-[var(--text)]`}
                style={{ outlineColor: accentColor }}
                aria-label="Gewichtsgruppe entfernen"
              >
                ×
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        onClick={handleAddEntry}
        size="sm"
        className={`${focusOutline} bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]`}
        style={{ outlineColor: accentColor }}
      >
        Gewichtsgruppe hinzufügen
      </Button>
    </div>
  );
}
