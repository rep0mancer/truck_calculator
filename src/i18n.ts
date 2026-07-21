export type Locale = 'de' | 'en';

export const translations = {
  de: {
    title: 'Laderaumrechner', subtitle: 'Visualisierung der Palettenplatzierung (Europäische Standards)', truckType: 'LKW-Typ:', reset: 'Alles zurücksetzen',
    dinPallets: 'Industriepaletten (DIN)', euroPallets: 'Europaletten (EUP)', fillDin: 'Rest mit max. DIN füllen', fillEup: 'Rest mit max. EUP füllen',
    stackable: 'Stapelbar (2-fach)', stackLimit: 'Stapelbare Paletten (0 = alle)', loadingPattern: 'EUP Lade-Pattern:', selected: 'Gewählt', none: 'Keines',
    auto: 'Auto-Optimieren', long: 'Längs (3 nebeneinander)', broad: 'Quer (2 nebeneinander)', visualization: 'Ladefläche Visualisierung', unit: 'Einheit', front: 'Front', empty: 'Keine Paletten zum Anzeigen.',
    loaded: 'Geladene Paletten (Visuell)', industrial: 'Industrie (DIN)', euro: 'Euro (EUP)', base: 'Basis', remaining: 'Verbleibende Kapazität', roomFor: 'Platz für:', more: 'weitere', or: 'oder', pallet: 'Palette', pallets: 'Paletten',
    weight: 'Geschätztes Gewicht', max: 'Max', messages: 'Meldungen', noProblems: 'Keine Probleme erkannt.', quantity: 'Anzahl', weightPer: 'Gewicht', addWeightGroup: 'Gewichtsgruppe hinzufügen', decrease: 'Menge reduzieren', increase: 'Menge erhöhen', remove: 'Gruppe entfernen', filledTitle: 'LKW aufgefüllt', filledDescription: 'Freier Platz wurde mit {type} Paletten gefüllt.',
  },
  en: {
    title: 'Load Space Calculator', subtitle: 'European-standard pallet placement visualization', truckType: 'Vehicle type:', reset: 'Reset all',
    dinPallets: 'Industrial pallets (DIN)', euroPallets: 'Euro pallets (EUP)', fillDin: 'Fill remaining space with DIN', fillEup: 'Fill remaining space with EUP',
    stackable: 'Stackable (two high)', stackLimit: 'Stackable pallets (0 = all)', loadingPattern: 'EUP loading pattern:', selected: 'Selected', none: 'None',
    auto: 'Optimize automatically', long: 'Lengthwise (3 abreast)', broad: 'Crosswise (2 abreast)', visualization: 'Load space visualization', unit: 'Unit', front: 'Front', empty: 'No pallets to display.',
    loaded: 'Loaded pallets (visual)', industrial: 'Industrial (DIN)', euro: 'Euro (EUP)', base: 'Floor positions', remaining: 'Remaining capacity', roomFor: 'Room for:', more: 'more', or: 'or', pallet: 'pallet', pallets: 'pallets',
    weight: 'Estimated weight', max: 'Max', messages: 'Messages', noProblems: 'No problems detected.', quantity: 'Quantity', weightPer: 'Weight', addWeightGroup: 'Add weight group', decrease: 'Decrease quantity', increase: 'Increase quantity', remove: 'Remove group', filledTitle: 'Truck filled', filledDescription: 'Free space was filled with {type} pallets.',
  },
} as const;

export type TranslationKey = keyof typeof translations.de;

export function translateWarning(warning: string, locale: Locale): string {
  if (locale === 'de') return warning;
  const exact: Record<string, string> = {
    'Gewichtslimit erreicht.': 'Weight limit reached.',
    'Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.': 'Info: stacking is not possible on rail wagons and was disabled.',
    'ACHTUNG – mehr als 10.5t auf weniger als 40% der Ladefläche': 'WARNING – more than 10.5 t is concentrated on less than 40% of the load floor.',
  };
  if (exact[warning]) return exact[warning];
  return warning
    .replace(/Die maximale Kapazität des Waggons von (\d+) EUP wurde überschritten\. (\d+) Palette\(n\) konnten nicht geladen werden\./, 'The wagon capacity of $1 EUP was exceeded. $2 pallet(s) could not be loaded.')
    .replace(/Konnte nicht alle Paletten laden\. Übrig: /, 'Not all pallets could be loaded. Remaining: ')
    .replace(/ und /g, ' and ')
    .replace(/Für diesen Auftrag werden (\d+) volle LKWs benötigt\./, 'This order requires $1 full trucks.')
    .replace(/Benötigt (\d+) LKWs: (\d+) volle LKW\(s\) und 1 LKW mit (\d+) Paletten\./, 'Requires $1 trucks: $2 full truck(s) and 1 truck with $3 pallets.')
    .replace(/maximale DIN-Kapazität ist (\d+)\. Angeforderte Menge (\d+), es werden (\d+) platziert\./, 'maximum DIN capacity is $1. $2 requested; $3 will be placed.')
    .replace(/ACHTUNG – mögliche Achslastüberschreitung: /, 'WARNING – possible axle-load exceedance: ')
    .replace(/ACHTUNG - ACHSLAST bei (DIN|EUP) im AUGE BEHALTEN! \((\d+) gestapelte (DIN|EUP)\)/, 'WARNING – monitor axle load for $1! ($2 stacked $3)');
}
