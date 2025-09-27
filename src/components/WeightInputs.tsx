'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StepperInput } from '@/components/forms/StepperInput';

export type WeightEntry = {
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
  variant?: 'legacy' | 'modern';
  createEntry?: () => WeightEntry;
}

export function WeightInputs({
  entries,
  onChange,
  palletType,
  preferredId = null,
  onSetPreferred,
  variant = 'legacy',
  createEntry,
}: WeightInputsProps) {
  const setPreferred = (id: number | null) => {
    if (onSetPreferred) {
      onSetPreferred(id);
    }
  };

  const handleAddEntry = () => {
    const nextEntry = createEntry ? createEntry() : { id: Date.now(), weight: '', quantity: 0 };
    onChange([...entries, nextEntry]);
  };

  const handleRemoveEntry = (id: number) => {
    if (id === preferredId) {
      setPreferred(null);
    }
    onChange(entries.filter(entry => entry.id !== id));
  };

  const handleEntryChange = (id: number, field: 'weight' | 'quantity', value: string) => {
    const newEntries = entries.map(entry => {
      if (entry.id === id) {
        const newQuantity = field === 'quantity' ? parseInt(value, 10) || 0 : entry.quantity;
        const newWeight = field === 'weight' ? value : entry.weight;
        if (newQuantity === 0 && id === preferredId) {
          setPreferred(null);
        }
        return { ...entry, quantity: newQuantity, weight: newWeight };
      }
      return entry;
    });
    onChange(newEntries);
  };

  if (variant === 'modern') {
    return (
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-[160px] flex-1">
                <label
                  htmlFor={`quantity-${palletType}-${entry.id}`}
                  className="mb-1 block text-sm font-medium text-[var(--text)]"
                >
                  Anzahl
                </label>
                <StepperInput
                  id={`quantity-${palletType}-${entry.id}`}
                  value={entry.quantity}
                  onChange={val => handleEntryChange(entry.id, 'quantity', String(val))}
                  min={0}
                  data-testid={`${palletType.toLowerCase()}-quantity-${index}`}
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <label
                  htmlFor={`weight-${palletType}-${entry.id}`}
                  className="mb-1 block text-sm font-medium text-[var(--text)]"
                >
                  Gewicht/{palletType} (kg)
                </label>
                <div className="relative">
                  <input
                    id={`weight-${palletType}-${entry.id}`}
                    type="number"
                    min={0}
                    value={entry.weight}
                    onChange={event => handleEntryChange(entry.id, 'weight', event.target.value)}
                    className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pr-10 text-right text-base text-[var(--text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                    inputMode="decimal"
                    data-testid={`${palletType.toLowerCase()}-weight-${index}`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--text-muted)]">
                    kg
                  </span>
                </div>
              </div>
              {entries.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--danger)] transition hover:border-[var(--danger)]/70 hover:text-[var(--danger)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2"
                >
                  Entfernen
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddEntry}
          className="text-sm font-semibold text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          + Gruppe hinzufügen
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="w-20 text-center text-xs text-gray-600">Anzahl</label>
        <label className="w-32 text-center text-xs text-gray-600">Gewicht/{palletType} (kg)</label>
      </div>
      {entries.map((entry, index) => (
        <div key={entry.id} className="mt-1 flex items-center gap-2">
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
              onChange={e => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder="Anzahl"
              className="w-16 text-center"
              data-testid={`${palletType.toLowerCase()}-quantity-${index}`}
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
            onChange={e => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`Gewicht/${palletType}`}
            className="w-32 text-center"
            data-testid={`${palletType.toLowerCase()}-weight-${index}`}
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
