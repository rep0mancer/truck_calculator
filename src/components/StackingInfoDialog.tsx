"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'stacking-info-dismissed';

export function StackingInfoDialog() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this dialog before
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Warum startet das Stapeln bei Position 9 (DIN) bzw. 10 (EUP)?</DialogTitle>
          <DialogDescription className="pt-2 space-y-3">
            <p className="text-sm text-slate-700">
              Das Stapeln beginnt erst ab Position 9 bei DIN-Paletten bzw. ab Position 10 bei EUP-Paletten, 
              um eine <strong>Achslastüberschreitung</strong> zu vermeiden.
            </p>
            <p className="text-sm text-slate-700">
              Die vorderen Positionen (1-8 bei DIN, 1-9 bei EUP) bleiben zunächst frei, da hier die 
              Gewichtsverteilung auf die Achsen besonders kritisch ist. Durch das Verschieben der 
              schweren gestapelten Paletten in die mittleren und hinteren Bereiche des LKWs wird 
              eine gleichmäßigere Lastverteilung erreicht.
            </p>
            <p className="text-sm text-slate-700">
              Erst wenn der verfügbare Platz in der Stapelzone nicht ausreicht, wird die Ladung 
              auf die gesamte Ladefläche erweitert. Dies gewährleistet sowohl eine optimale 
              Raumnutzung als auch die Einhaltung der zulässigen Achslasten.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="dont-show-again"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Ich habe verstanden, nicht mehr anzeigen
            </label>
          </div>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
