'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { translations, type Locale } from '@/i18n';

type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
};

interface WeightInputsProps {
  entries: WeightEntry[];
  onChange: (entries: WeightEntry[]) => void;
  palletType: 'EUP' | 'DIN';
  locale: Locale;
}

export function WeightInputs({ entries, onChange, palletType, locale }: WeightInputsProps) {
  const t = translations[locale];
  const handleAddEntry = () => {
    const maxId = entries.reduce((max, entry) => Math.max(max, entry.id), 0);
    onChange([...entries, { id: maxId + 1, weight: '', quantity: 0 }]);
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
      <div className="flex items-center gap-2 mb-2">
        <label className="w-20 text-center text-xs font-semibold text-slate-600">{t.quantity}</label>
        <label className="w-32 text-center text-xs font-semibold text-slate-600">{t.weightPer}/{palletType} (kg)</label>
      </div>
      {entries.map(entry => (
        <div key={entry.id} className="flex items-center gap-3 mt-2 rounded-2xl border border-white/30 bg-white/10 px-3 py-2 backdrop-blur-xl shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(Math.max(0, entry.quantity - 1)))}
              aria-label={t.decrease}
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              value={entry.quantity}
              onChange={(e) => handleEntryChange(entry.id, 'quantity', e.target.value)}
              placeholder={t.quantity}
              className="w-16 text-center font-semibold"
            />
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
              onClick={() => handleEntryChange(entry.id, 'quantity', String(entry.quantity + 1))}
              aria-label={t.increase}
            >
              +
            </button>
          </div>
          <Input
            type="number"
            min="0"
            value={entry.weight}
            onChange={(e) => handleEntryChange(entry.id, 'weight', e.target.value)}
            placeholder={`${t.weightPer}/${palletType}`}
            className="w-32 text-center font-semibold"
          />
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveEntry(entry.id)}
              className="h-8 w-8 flex items-center justify-center rounded-full text-base font-semibold leading-none"
              aria-label={t.remove}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button onClick={handleAddEntry} className="mt-3 w-full py-2 text-sm font-semibold tracking-wide rounded-2xl">
        {t.addWeightGroup}
      </button>
    </div>
  );
}
