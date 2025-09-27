'use client';

import React from 'react';
import clsx from 'clsx';
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
  accentColor?: string;
  variant?: 'legacy' | 'modern';
}

export function WeightInputs({
  entries,
  onChange,
  palletType,
  preferredId = null,
  onSetPreferred = () => undefined,
  accentColor,
  variant = 'modern',
}: WeightInputsProps) {
  const accent = accentColor ?? (palletType === 'DIN' ? 'var(--accent-din)' : 'var(--accent-eup)');
  const focusRingClass = 'focus-visible:outline outline-2 outline-offset-2 focus-visible:ring-0';
  const focusRingStyle = { outlineColor: accent } as React.CSSProperties;

  const handleAddEntry = () => {
    onChange([...entries, { id: Date.now(), weight: '', quantity: 0 }]);
  };

  const handleRemoveEntry = (id: number) => {
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
        if (newQuantity === 0 && id === preferredId) {
          onSetPreferred(null);
        }
        return { ...entry, quantity: newQuantity, weight: newWeight };
      }
      return entry;
    });
    onChange(newEntries);
  };

  const quantityHeaderId = React.useId();
  const weightHeaderId = React.useId();

  if (variant === 'legacy') {
    return (
      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className="w-20 text-center text-xs text-gray-600">Anzahl</label>
          <label className="w-32 text-center text-xs text-gray-600">Gewicht/{palletType} (kg)</label>
        </div>
        {entries.map(entry => (
          <div key={entry.id} className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-2"
                onClick={() =>
                  handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))
                }
              >
                -
              </Button>
              <Input
                type="number"
                min="0"
                value={entry.quantity}
                onChange={event => handleEntryChange(entry.id, 'quantity', event.target.value)}
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
              onChange={event => handleEntryChange(entry.id, 'weight', event.target.value)}
              placeholder={`Gewicht/${palletType}`}
              className="w-32 text-center"
            />
            {entries.length > 1 && (
              <Button
                onClick={() => handleRemoveEntry(entry.id)}
                variant="destructive"
                size="sm"
              >
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(140px,auto)_minmax(160px,1fr)_auto] items-center gap-3 text-xs text-[var(--text-muted)]">
        <span id={quantityHeaderId}>Paletten</span>
        <span id={weightHeaderId}>Gewicht pro Palette</span>
        <span className="text-right">Aktion</span>
      </div>
      <div className="space-y-2">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="grid grid-cols-[minmax(140px,auto)_minmax(160px,1fr)_auto] items-center gap-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm text-[var(--text)] dark:bg-[color-mix(in_oklab,var(--surface)65%,transparent)]"
          >
            <div className="flex items-center justify-start gap-2" aria-labelledby={quantityHeaderId}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Eine Palette weniger"
                onClick={() =>
                  handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))
                }
                className={clsx('h-8 w-8 rounded-full border-[var(--border)] bg-[var(--surface)] text-base', focusRingClass)}
                style={focusRingStyle}
              >
                −
              </Button>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                type="number"
                min="0"
                value={entry.quantity}
                onChange={event => handleEntryChange(entry.id, 'quantity', event.target.value)}
                aria-labelledby={quantityHeaderId}
                className={clsx(
                  'h-9 w-20 rounded-lg border-[var(--border)] bg-[var(--surface)] text-right font-semibold',
                  focusRingClass
                )}
                style={focusRingStyle}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Eine Palette mehr"
                onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
                className={clsx('h-8 w-8 rounded-full border-[var(--border)] bg-[var(--surface)] text-base', focusRingClass)}
                style={focusRingStyle}
              >
                +
              </Button>
            </div>
            <div className="flex items-center" aria-labelledby={weightHeaderId}>
              <div className="relative w-full">
                <Input
                  type="number"
                  min="0"
                  value={entry.weight}
                  onChange={event => handleEntryChange(entry.id, 'weight', event.target.value)}
                  aria-labelledby={weightHeaderId}
                  className={clsx(
                    'h-9 w-full rounded-lg border-[var(--border)] bg-[var(--surface)] pr-12 text-right font-semibold',
                    focusRingClass
                  )}
                  style={focusRingStyle}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--text-muted)]">
                  kg
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              {entries.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Gewichtsgruppe entfernen"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className={clsx(
                    'h-8 w-8 rounded-full text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)10%,transparent)]',
                    focusRingClass
                  )}
                  style={{ outlineColor: 'var(--danger)' }}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        onClick={handleAddEntry}
        className={clsx('button-primary w-full rounded-xl py-2 text-sm font-semibold', focusRingClass)}
        style={focusRingStyle}
      >
        Gewichtsgruppe hinzufügen
      </Button>
    </div>
  );
}
