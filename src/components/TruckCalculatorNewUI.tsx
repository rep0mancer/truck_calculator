import React from 'react';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { KPIStat } from '@/components/ui/KPIStat';
import { StepperInput } from '@/components/forms/StepperInput';
import { Switch as StackSwitch } from '@/components/forms/Switch';
import { Segmented } from '@/components/forms/Segmented';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { Legend } from '@/components/canvas/Legend';

type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
};

interface TruckTypeConfig {
  name: string;
  units: Array<{ id: string; length: number; width: number; occupiedRects?: any[] }>;
  totalLength: number;
  usableLength?: number;
  maxWidth: number;
  maxGrossWeightKg?: number;
  maxDinPallets?: number;
}

interface TruckCalculatorNewUIProps {
  selectedTruck: string;
  onSelectTruck: (value: string) => void;
  truckTypes: Record<string, TruckTypeConfig>;
  selectedTruckConfig: TruckTypeConfig;
  isWaggonSelected: boolean;
  dinWeights: WeightEntry[];
  eupWeights: WeightEntry[];
  onWeightChange: (type: 'eup' | 'din', id: number, field: 'quantity' | 'weight', value: number | string) => void;
  onAddWeightGroup: (type: 'eup' | 'din') => void;
  onRemoveWeightGroup: (type: 'eup' | 'din', id: number) => void;
  onMaximize: (type: 'euro' | 'industrial') => void;
  onFillRemaining: (type: 'euro' | 'industrial') => void;
  isDINStackable: boolean;
  isEUPStackable: boolean;
  onToggleDINStackable: (checked: boolean) => void;
  onToggleEUPStackable: (checked: boolean) => void;
  dinStackLimit: number;
  eupStackLimit: number;
  onChangeDinStackLimit: (value: number) => void;
  onChangeEupStackLimit: (value: number) => void;
  eupLoadingPattern: 'auto' | 'long' | 'broad';
  onChangeEupLoadingPattern: (value: 'auto' | 'long' | 'broad') => void;
  actualEupLoadingPattern: string;
  onOptimize: () => void;
  onResetAll: () => void;
  onHelp: () => void;
  palletArrangement: any[];
  renderPallet: (pallet: any, scale: number, options: { showNear: boolean; showOver: boolean }) => React.ReactNode;
  canvasScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  totalDinPalletsVisual: number;
  totalEuroPalletsVisual: number;
  loadedIndustrialPalletsBase: number;
  loadedEuroPalletsBase: number;
  remainingCapacity: { din: number; eup: number };
  lastEdited: 'eup' | 'din';
  totalWeightKg: number;
  maxGrossWeightKg: number;
  utilizationPercentage: number;
  warnings: string[];
  liveAnnouncement: string;
  formatKilograms: (value: number) => string;
}

export function TruckCalculatorNewUI({
  selectedTruck,
  onSelectTruck,
  truckTypes,
  selectedTruckConfig,
  isWaggonSelected,
  dinWeights,
  eupWeights,
  onWeightChange,
  onAddWeightGroup,
  onRemoveWeightGroup,
  onMaximize,
  onFillRemaining,
  isDINStackable,
  isEUPStackable,
  onToggleDINStackable,
  onToggleEUPStackable,
  dinStackLimit,
  eupStackLimit,
  onChangeDinStackLimit,
  onChangeEupStackLimit,
  eupLoadingPattern,
  onChangeEupLoadingPattern,
  actualEupLoadingPattern,
  onOptimize,
  onResetAll,
  onHelp,
  palletArrangement,
  renderPallet,
  canvasScale,
  onZoomIn,
  onZoomOut,
  onResetView,
  totalDinPalletsVisual,
  totalEuroPalletsVisual,
  loadedIndustrialPalletsBase,
  loadedEuroPalletsBase,
  remainingCapacity,
  lastEdited,
  totalWeightKg,
  maxGrossWeightKg,
  utilizationPercentage,
  warnings,
  liveAnnouncement,
  formatKilograms,
}: TruckCalculatorNewUIProps) {
  const totalPalletsLoaded = totalDinPalletsVisual + totalEuroPalletsVisual;
  const weightRatio = maxGrossWeightKg > 0 ? totalWeightKg / maxGrossWeightKg : 0;
  const isOverWeightLimit = weightRatio > 1;
  const isNearWeightLimit = !isOverWeightLimit && weightRatio >= 0.9;
  const weightMarginKg = maxGrossWeightKg - totalWeightKg;
  const weightMarginLabel =
    weightMarginKg >= 0
      ? `${formatKilograms(Math.max(0, Math.round(weightMarginKg)))} kg Rest`
      : `${formatKilograms(Math.abs(Math.round(weightMarginKg)))} kg Überladung`;
  const marginThreshold = maxGrossWeightKg > 0 ? maxGrossWeightKg * 0.1 : 0;
  const weightStatus: 'neutral' | 'warn' | 'error' | 'ok' = isOverWeightLimit ? 'error' : isNearWeightLimit ? 'warn' : totalWeightKg > 0 ? 'ok' : 'neutral';
  const marginStatus: 'neutral' | 'warn' | 'error' | 'ok' =
    weightMarginKg < 0 ? 'error' : weightMarginKg <= marginThreshold ? 'warn' : totalWeightKg > 0 ? 'ok' : 'neutral';
  const palletsStatus: 'neutral' | 'warn' | 'error' | 'ok' =
    totalPalletsLoaded === 0 ? 'neutral' : warnings.some(w => w.toLowerCase().includes('konnte nicht')) ? 'warn' : 'ok';
  const scalePercentage = Math.round((canvasScale / 0.35) * 100);
  const firstCapacityType = lastEdited === 'din' ? 'DIN' : 'EUP';
  const secondCapacityType = lastEdited === 'din' ? 'EUP' : 'DIN';
  const firstCapacityValue = lastEdited === 'din' ? remainingCapacity.din : remainingCapacity.eup;
  const secondCapacityValue = lastEdited === 'din' ? remainingCapacity.eup : remainingCapacity.din;
  const actualPatternLabel =
    actualEupLoadingPattern === 'none'
      ? 'Kein Muster'
      : actualEupLoadingPattern === 'long'
      ? 'Längs'
      : actualEupLoadingPattern === 'broad'
      ? 'Quer'
      : 'Automatisch';

  const renderWeightGroups = (type: 'eup' | 'din', weights: WeightEntry[]) => (
    <div className="mt-3 space-y-3">
      {weights.map(entry => (
        <div key={entry.id} className="flex items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor={`${type}-qty-${entry.id}`}
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              Anzahl
            </label>
            <StepperInput
              id={`${type}-qty-${entry.id}`}
              value={entry.quantity}
              min={0}
              onChange={(val: number) => onWeightChange(type, entry.id, 'quantity', val)}
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor={`${type}-weight-${entry.id}`}
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              Gewicht (kg)
            </label>
            <div className="relative">
              <input
                id={`${type}-weight-${entry.id}`}
                type="number"
                min="0"
                inputMode="decimal"
                value={entry.weight}
                onChange={event => onWeightChange(type, entry.id, 'weight', event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pr-10 text-right text-sm text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--text-muted)]">kg</span>
            </div>
          </div>
          {weights.length > 1 ? (
            <button
              type="button"
              onClick={() => onRemoveWeightGroup(type, entry.id)}
              className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
              aria-label={`${type === 'eup' ? 'EUP' : 'DIN'}-Gruppe entfernen`}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );

  const modernRail = (
    <>
      <Card title="LKW">
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="truckType" className="text-sm font-medium text-[var(--text)]">
              LKW-Typ
            </label>
            <select
              id="truckType"
              value={selectedTruck}
              onChange={event => onSelectTruck(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            >
              {Object.keys(truckTypes).map(key => (
                <option key={key} value={key}>
                  {truckTypes[key].name}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <p>Gesamtlänge: {(selectedTruckConfig.totalLength / 100).toFixed(1)} m</p>
            <p>Nutzbreite: {(selectedTruckConfig.maxWidth / 100).toFixed(2)} m</p>
            <p>Zuladung: {formatKilograms(maxGrossWeightKg)} kg</p>
          </div>
        </div>
      </Card>
      <Card title="Industriepaletten (DIN)">
        <div className="space-y-4">
          {renderWeightGroups('din', dinWeights)}
          <button
            type="button"
            onClick={() => onAddWeightGroup('din')}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Gruppe hinzufügen
          </button>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => onMaximize('industrial')}
              className="h-11 rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Max. DIN
            </button>
            <button
              type="button"
              onClick={() => onFillRemaining('industrial')}
              className="h-11 rounded-xl border border-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Rest mit max. DIN füllen
            </button>
          </div>
          <StackSwitch
            id="din-stackable"
            checked={isDINStackable}
            onChange={onToggleDINStackable}
            disabled={isWaggonSelected}
            label="Stapelbar (2-fach)"
            helperText={isWaggonSelected ? 'Auf dem Waggon nicht verfügbar.' : 'Maximale Stapelhöhe von zwei Paletten.'}
          />
          {isDINStackable && !isWaggonSelected ? (
            <div className="space-y-1">
              <label
                htmlFor="din-stack-limit"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              >
                Max. stapelbare Paletten
              </label>
              <StepperInput id="din-stack-limit" value={dinStackLimit} min={0} onChange={onChangeDinStackLimit} />
              <p className="text-xs text-[var(--text-muted)]">0 bedeutet unbegrenzt.</p>
            </div>
          ) : null}
        </div>
      </Card>
      <Card title="Europaletten (EUP)">
        <div className="space-y-4">
          {renderWeightGroups('eup', eupWeights)}
          <button
            type="button"
            onClick={() => onAddWeightGroup('eup')}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Gruppe hinzufügen
          </button>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => onMaximize('euro')}
              className="h-11 rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Max. EUP
            </button>
            <button
              type="button"
              onClick={() => onFillRemaining('euro')}
              className="h-11 rounded-xl border border-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Rest mit max. EUP füllen
            </button>
          </div>
          <StackSwitch
            id="eup-stackable"
            checked={isEUPStackable}
            onChange={onToggleEUPStackable}
            disabled={isWaggonSelected}
            label="Stapelbar (2-fach)"
            helperText={isWaggonSelected ? 'Auf dem Waggon nicht verfügbar.' : 'Stapelung reduziert den benötigten Platz.'}
          />
          {isEUPStackable && !isWaggonSelected ? (
            <div className="space-y-1">
              <label
                htmlFor="eup-stack-limit"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              >
                Max. stapelbare Paletten
              </label>
              <StepperInput id="eup-stack-limit" value={eupStackLimit} min={0} onChange={onChangeEupStackLimit} />
              <p className="text-xs text-[var(--text-muted)]">0 bedeutet unbegrenzt.</p>
            </div>
          ) : null}
        </div>
      </Card>
      <Card title="EUP Lade-Pattern">
        <div className="space-y-2">
          <Segmented
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Längs', value: 'long' },
              { label: 'Quer', value: 'broad' },
            ]}
            value={eupLoadingPattern}
            onChange={value => onChangeEupLoadingPattern(value as 'auto' | 'long' | 'broad')}
          />
          <p className="text-xs text-[var(--text-muted)]">Aktuell genutzt: {actualPatternLabel}</p>
        </div>
      </Card>
      <div className="sticky bottom-0">
        <Card title="Aktionen">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onOptimize}
              className="h-11 rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Layout optimieren
            </button>
            <button
              type="button"
              onClick={onResetAll}
              className="h-11 rounded-xl border border-[var(--danger)] px-3 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
            >
              Alles zurücksetzen
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Optimierung berechnet die Beladung mit den aktuellen Parametern.</p>
        </Card>
      </div>
    </>
  );

  const modernCanvas = (
    <>
      <Card
        title="Ladefläche Visualisierung"
        actions={<CanvasToolbar onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onResetView} />}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span>Skalierung: {scalePercentage}%</span>
            <span>Gewicht: {isOverWeightLimit ? 'Über Limit' : isNearWeightLimit ? 'Nahe am Limit' : 'Im grünen Bereich'}</span>
          </div>
          {palletArrangement.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Keine Paletten zum Anzeigen.</p>
          ) : (
            palletArrangement.map((unit: any, index: number) => {
              const widthPx = unit.unitWidth * canvasScale;
              const lengthPx = unit.unitLength * canvasScale;
              const gridSize = Math.max(24, canvasScale * 80);
              const unitCount = truckTypes[selectedTruck]?.units?.length || 1;
              return (
                <div key={unit.unitId} className="space-y-3">
                  {unitCount > 1 ? (
                    <p className="text-sm font-medium text-[var(--text)]">
                      Einheit {index + 1} ({(unit.unitLength / 100).toFixed(1)} m × {(unit.unitWidth / 100).toFixed(2)} m)
                    </p>
                  ) : null}
                  <div className="relative" style={{ width: `${widthPx + 60}px`, height: `${lengthPx}px` }}>
                    <div className="canvas-ruler">
                      <span>0 m</span>
                      <span>{(unit.unitLength / 100).toFixed(1)} m</span>
                    </div>
                    <div className="absolute left-12 top-0" style={{ width: `${widthPx}px`, height: `${lengthPx}px` }}>
                      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--canvas)]">
                        <div className="canvas-grid" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }} />
                        <div className="canvas-track" />
                        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--surface)]/90 px-3 py-1 text-xs font-medium text-[var(--text-muted)] shadow-sm">
                          <span className="inline-block text-[var(--primary)]">▲</span>
                          Front
                        </div>
                        {unit.pallets.map((pallet: any) =>
                          renderPallet(pallet, canvasScale, { showNear: isNearWeightLimit, showOver: isOverWeightLimit })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className="flex justify-end">
            <Legend isNearLimit={isNearWeightLimit} isOverLimit={isOverWeightLimit} />
          </div>
        </div>
      </Card>
      <Card title="Verbleibende Kapazität">
        <div className="space-y-2 text-sm text-[var(--text)]">
          <p className="font-semibold">Platz für:</p>
          <p>
            {firstCapacityValue} weitere {firstCapacityType} {firstCapacityValue === 1 ? 'Palette' : 'Paletten'}
          </p>
          <p className="text-[var(--text-muted)]">oder</p>
          <p>
            {secondCapacityValue} weitere {secondCapacityType} {secondCapacityValue === 1 ? 'Palette' : 'Paletten'}
          </p>
        </div>
      </Card>
      <Card title="Meldungen">
        {warnings.length > 0 ? (
          <ul className="space-y-2 text-sm text-[var(--text)]">
            {warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={`mt-1 inline-block h-2 w-2 rounded-full ${warning.toLowerCase().includes('achtung') ? 'bg-[var(--warning)]' : 'bg-[var(--primary)]'}`}
                />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Keine Probleme erkannt.</p>
        )}
      </Card>
    </>
  );

  const kpiFooter = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <KPIStat
        label="Geladene Paletten"
        value={`${totalPalletsLoaded} Stück`}
        status={palletsStatus}
        helper={`DIN: ${loadedIndustrialPalletsBase}, EUP: ${loadedEuroPalletsBase}`}
      />
      <KPIStat
        label="Berechnetes Gewicht"
        value={`${formatKilograms(totalWeightKg)} kg`}
        status={weightStatus}
        helper={`Max: ${formatKilograms(maxGrossWeightKg)} kg`}
      />
      <KPIStat
        label="Gewichtsspielraum"
        value={weightMarginLabel}
        status={marginStatus}
        helper={`Auslastung: ${utilizationPercentage.toFixed(1)}%`}
      />
    </div>
  );

  return (
    <>
      <PageShell
        title="Laderaumrechner"
        subtitle="Moderne Visualisierung und Planung Ihrer Paletten"
        headerActions={
          <>
            <button
              type="button"
              onClick={onHelp}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              aria-label="Hilfe anzeigen"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onResetAll}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              aria-label="Einstellungen zurücksetzen"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </>
        }
        rail={modernRail}
        canvas={
          <>
            <div className="sr-only" aria-live="polite">
              {liveAnnouncement}
            </div>
            {modernCanvas}
          </>
        }
        footer={kpiFooter}
      />
    </>
  );
}
