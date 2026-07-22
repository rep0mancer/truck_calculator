export type Locale = 'de' | 'gsw' | 'fr' | 'en' | 'it' | 'hr' | 'sk' | 'cs' | 'uk';

export const translations = {
  de: {
    title: 'Laderaumrechner', subtitle: 'Visualisierung der Palettenplatzierung (Europäische Standards)', truckType: 'LKW-Typ:', reset: 'Alles zurücksetzen',
    dinPallets: 'Industriepaletten (DIN)', euroPallets: 'Europaletten (EUP)', fillDin: 'Rest mit max. DIN füllen', fillEup: 'Rest mit max. EUP füllen',
    stackable: 'Stapelbar (2-fach)', stackLimit: 'Stapelbare Paletten (0 = alle)', loadingPattern: 'EUP Lade-Pattern:', selected: 'Gewählt', none: 'Keines',
    stackingStrategy: 'Stapelstrategie', stackOnlyWhenRequired: 'Nur bei Bedarf stapeln', forceStacking: 'Stapeln erzwingen',
    auto: 'Auto-Optimieren', long: 'Längs (3 nebeneinander)', broad: 'Quer (2 nebeneinander)', visualization: 'Ladefläche Visualisierung', unit: 'Einheit', front: 'Front', empty: 'Keine Paletten zum Anzeigen.',
    loaded: 'Geladene Paletten (Visuell)', industrial: 'Industrie (DIN)', euro: 'Euro (EUP)', base: 'Basis', remaining: 'Verbleibende Kapazität', roomFor: 'Platz für:', more: 'weitere', or: 'oder', pallet: 'Palette', pallets: 'Paletten',
    weight: 'Geschätztes Gewicht', max: 'Max', messages: 'Meldungen', noProblems: 'Keine Probleme erkannt.', quantity: 'Anzahl', weightPer: 'Gewicht', addWeightGroup: 'Gewichtsgruppe hinzufügen', decrease: 'Menge reduzieren', increase: 'Menge erhöhen', remove: 'Gruppe entfernen', filledTitle: 'LKW aufgefüllt', filledDescription: 'Freier Platz wurde mit {type} Paletten gefüllt.',
  },
  gsw: {
    title: 'Laderaumrächner', subtitle: 'So chön chönnted d Palettli im Laschti stah (europäischi Standards)', truckType: 'Laschti-Typ:', reset: 'Alles zruggsetze',
    dinPallets: 'Industriepalettli (DIN)', euroPallets: 'Europalettli (EUP)', fillDin: 'De Räscht mit DIN uffülle', fillEup: 'De Räscht mit EUP uffülle',
    stackable: 'Stapelbar (zweifach)', stackLimit: 'Stapelbari Palettli (0 = alli)', loadingPattern: 'EUP-Lademuster:', selected: 'Usgwählt', none: 'Nüt',
    stackingStrategy: 'Stapelstrategie', stackOnlyWhenRequired: 'Nur staple, wenn nötig', forceStacking: 'Staple erzwinge',
    auto: 'Automatisch optimiere', long: 'Längs (3 näbenand)', broad: 'Quer (2 näbenand)', visualization: 'Ladeflächi zum Aaluege', unit: 'Einheit', front: 'Vorne', empty: 'Kei Palettli zum Aaluege.',
    loaded: 'Gladeni Palettli (visuell)', industrial: 'Industrie (DIN)', euro: 'Euro (EUP)', base: 'Bodeplätz', remaining: 'Übrigi Kapazität', roomFor: 'Platz für:', more: 'meh', or: 'oder', pallet: 'Palettli', pallets: 'Palettli',
    weight: 'Gschätzts Gwicht', max: 'Max', messages: 'Meldigä', noProblems: 'Alles tipptopp.', quantity: 'Aazahl', weightPer: 'Gwicht', addWeightGroup: 'Gwichtsgruppe dezue tue', decrease: 'Weniger', increase: 'Meh', remove: 'Gruppe furtue', filledTitle: 'Laschti isch voll', filledDescription: 'De freii Platz isch mit {type}-Palettli uffüllt worde.',
  },
  fr: {
    title: 'Calculateur d\'espace de chargement', subtitle: 'Visualisation du placement des palettes selon les normes européennes', truckType: 'Type de véhicule :', reset: 'Tout réinitialiser',
    dinPallets: 'Palettes industrielles (DIN)', euroPallets: 'Europalettes (EUP)', fillDin: 'Remplir l\'espace restant avec des DIN', fillEup: 'Remplir l\'espace restant avec des EUP',
    stackable: 'Empilables (sur 2 niveaux)', stackLimit: 'Palettes empilables (0 = toutes)', loadingPattern: 'Schéma de chargement EUP :', selected: 'Sélectionné', none: 'Aucun',
    stackingStrategy: 'Stratégie d’empilage', stackOnlyWhenRequired: 'Empiler uniquement si nécessaire', forceStacking: 'Forcer l’empilage',
    auto: 'Optimiser automatiquement', long: 'En longueur (3 côte à côte)', broad: 'En largeur (2 côte à côte)', visualization: 'Visualisation de l\'espace de chargement', unit: 'Unité', front: 'Avant', empty: 'Aucune palette à afficher.',
    loaded: 'Palettes chargées (visuel)', industrial: 'Industrielles (DIN)', euro: 'Euro (EUP)', base: 'Places au sol', remaining: 'Capacité restante', roomFor: 'Place pour :', more: 'de plus', or: 'ou', pallet: 'palette', pallets: 'palettes',
    weight: 'Poids estimé', max: 'Max.', messages: 'Messages', noProblems: 'Aucun problème détecté.', quantity: 'Quantité', weightPer: 'Poids', addWeightGroup: 'Ajouter un groupe de poids', decrease: 'Réduire la quantité', increase: 'Augmenter la quantité', remove: 'Supprimer le groupe', filledTitle: 'Véhicule rempli', filledDescription: 'L\'espace libre a été rempli avec des palettes {type}.',
  },
  en: {
    title: 'Load Space Calculator', subtitle: 'European-standard pallet placement visualization', truckType: 'Vehicle type:', reset: 'Reset all',
    dinPallets: 'Industrial pallets (DIN)', euroPallets: 'Euro pallets (EUP)', fillDin: 'Fill remaining space with DIN', fillEup: 'Fill remaining space with EUP',
    stackable: 'Stackable (two high)', stackLimit: 'Stackable pallets (0 = all)', loadingPattern: 'EUP loading pattern:', selected: 'Selected', none: 'None',
    stackingStrategy: 'Stacking strategy', stackOnlyWhenRequired: 'Stack only when required', forceStacking: 'Force stacking',
    auto: 'Optimize automatically', long: 'Lengthwise (3 abreast)', broad: 'Crosswise (2 abreast)', visualization: 'Load space visualization', unit: 'Unit', front: 'Front', empty: 'No pallets to display.',
    loaded: 'Loaded pallets (visual)', industrial: 'Industrial (DIN)', euro: 'Euro (EUP)', base: 'Floor positions', remaining: 'Remaining capacity', roomFor: 'Room for:', more: 'more', or: 'or', pallet: 'pallet', pallets: 'pallets',
    weight: 'Estimated weight', max: 'Max', messages: 'Messages', noProblems: 'No problems detected.', quantity: 'Quantity', weightPer: 'Weight', addWeightGroup: 'Add weight group', decrease: 'Decrease quantity', increase: 'Increase quantity', remove: 'Remove group', filledTitle: 'Truck filled', filledDescription: 'Free space was filled with {type} pallets.',
  },

  it: {
    title: 'Calcolatore spazio di carico', subtitle: 'Visualizzazione del posizionamento pallet secondo gli standard europei', truckType: 'Tipo di veicolo:', reset: 'Ripristina tutto',
    dinPallets: 'Pallet industriali (DIN)', euroPallets: 'Europallet (EUP)', fillDin: 'Riempi lo spazio con DIN', fillEup: 'Riempi lo spazio con EUP',
    stackable: 'Impilabile (doppio)', stackLimit: 'Pallet impilabili (0 = tutti)', loadingPattern: 'Schema di carico EUP:', selected: 'Selezionato', none: 'Nessuno',
    stackingStrategy: 'Strategia di impilamento', stackOnlyWhenRequired: 'Impila solo se necessario', forceStacking: 'Forza l’impilamento',
    auto: 'Ottimizza automaticamente', long: 'Longitudinale (3 affiancati)', broad: 'Trasversale (2 affiancati)', visualization: 'Visualizzazione spazio di carico', unit: 'Unità', front: 'Fronte', empty: 'Nessun pallet da visualizzare.',
    loaded: 'Pallet caricati (vista)', industrial: 'Industriali (DIN)', euro: 'Euro (EUP)', base: 'Posti a terra', remaining: 'Capacità residua', roomFor: 'Spazio per:', more: 'altri', or: 'oppure', pallet: 'pallet', pallets: 'pallet',
    weight: 'Peso stimato', max: 'Max', messages: 'Messaggi', noProblems: 'Nessun problema rilevato.', quantity: 'Quantità', weightPer: 'Peso', addWeightGroup: 'Aggiungi gruppo di peso', decrease: 'Riduci quantità', increase: 'Aumenta quantità', remove: 'Rimuovi gruppo', filledTitle: 'Veicolo riempito', filledDescription: 'Lo spazio libero è stato riempito con pallet {type}.',
  },
  hr: {
    title: 'Kalkulator utovarnog prostora', subtitle: 'Prikaz smještaja paleta prema europskim standardima', truckType: 'Vrsta vozila:', reset: 'Poništi sve',
    dinPallets: 'Industrijske palete (DIN)', euroPallets: 'Euro palete (EUP)', fillDin: 'Popuni preostalo s DIN', fillEup: 'Popuni preostalo s EUP',
    stackable: 'Slaganje u dva nivoa', stackLimit: 'Palete za slaganje (0 = sve)', loadingPattern: 'Uzorak utovara EUP:', selected: 'Odabrano', none: 'Nijedan',
    stackingStrategy: 'Strategija slaganja', stackOnlyWhenRequired: 'Složi samo kada je potrebno', forceStacking: 'Prisili slaganje',
    auto: 'Automatska optimizacija', long: 'Uzdužno (3 usporedno)', broad: 'Poprečno (2 usporedno)', visualization: 'Prikaz utovarnog prostora', unit: 'Jedinica', front: 'Prednja strana', empty: 'Nema paleta za prikaz.',
    loaded: 'Utovarene palete (prikaz)', industrial: 'Industrijske (DIN)', euro: 'Euro (EUP)', base: 'Podna mjesta', remaining: 'Preostali kapacitet', roomFor: 'Mjesta za:', more: 'još', or: 'ili', pallet: 'paletu', pallets: 'paleta',
    weight: 'Procijenjena težina', max: 'Maks.', messages: 'Poruke', noProblems: 'Nema uočenih problema.', quantity: 'Količina', weightPer: 'Težina', addWeightGroup: 'Dodaj grupu težine', decrease: 'Smanji količinu', increase: 'Povećaj količinu', remove: 'Ukloni grupu', filledTitle: 'Vozilo je popunjeno', filledDescription: 'Slobodan prostor popunjen je paletama {type}.',
  },
  sk: {
    title: 'Kalkulačka nákladného priestoru', subtitle: 'Vizualizácia uloženia paliet podľa európskych noriem', truckType: 'Typ vozidla:', reset: 'Obnoviť všetko',
    dinPallets: 'Priemyselné palety (DIN)', euroPallets: 'Europalety (EUP)', fillDin: 'Vyplniť zvyšok DIN', fillEup: 'Vyplniť zvyšok EUP',
    stackable: 'Stohovateľné (2 vrstvy)', stackLimit: 'Stohovateľné palety (0 = všetky)', loadingPattern: 'Vzor nakladania EUP:', selected: 'Vybrané', none: 'Žiadny',
    stackingStrategy: 'Stratégia stohovania', stackOnlyWhenRequired: 'Stohovať iba v prípade potreby', forceStacking: 'Vynútiť stohovanie',
    auto: 'Automaticky optimalizovať', long: 'Pozdĺžne (3 vedľa seba)', broad: 'Priečne (2 vedľa seba)', visualization: 'Vizualizácia nákladného priestoru', unit: 'Jednotka', front: 'Predná časť', empty: 'Žiadne palety na zobrazenie.',
    loaded: 'Naložené palety (vizuálne)', industrial: 'Priemyselné (DIN)', euro: 'Euro (EUP)', base: 'Podlahové miesta', remaining: 'Zostávajúca kapacita', roomFor: 'Miesto pre:', more: 'ďalších', or: 'alebo', pallet: 'paletu', pallets: 'paliet',
    weight: 'Odhadovaná hmotnosť', max: 'Max.', messages: 'Správy', noProblems: 'Neboli zistené žiadne problémy.', quantity: 'Počet', weightPer: 'Hmotnosť', addWeightGroup: 'Pridať hmotnostnú skupinu', decrease: 'Znížiť počet', increase: 'Zvýšiť počet', remove: 'Odstrániť skupinu', filledTitle: 'Vozidlo naplnené', filledDescription: 'Voľný priestor bol vyplnený paletami {type}.',
  },
  cs: {
    title: 'Kalkulačka nákladového prostoru', subtitle: 'Vizualizace uložení palet podle evropských norem', truckType: 'Typ vozidla:', reset: 'Obnovit vše',
    dinPallets: 'Průmyslové palety (DIN)', euroPallets: 'Europalety (EUP)', fillDin: 'Vyplnit zbytek DIN', fillEup: 'Vyplnit zbytek EUP',
    stackable: 'Stohovatelné (2 vrstvy)', stackLimit: 'Stohovatelné palety (0 = všechny)', loadingPattern: 'Vzor nakládání EUP:', selected: 'Vybráno', none: 'Žádný',
    stackingStrategy: 'Strategie stohování', stackOnlyWhenRequired: 'Stohovat pouze v případě potřeby', forceStacking: 'Vynutit stohování',
    auto: 'Automaticky optimalizovat', long: 'Podélně (3 vedle sebe)', broad: 'Příčně (2 vedle sebe)', visualization: 'Vizualizace nákladového prostoru', unit: 'Jednotka', front: 'Přední část', empty: 'Žádné palety k zobrazení.',
    loaded: 'Naložené palety (vizuálně)', industrial: 'Průmyslové (DIN)', euro: 'Euro (EUP)', base: 'Podlahová místa', remaining: 'Zbývající kapacita', roomFor: 'Místo pro:', more: 'dalších', or: 'nebo', pallet: 'paletu', pallets: 'palet',
    weight: 'Odhadovaná hmotnost', max: 'Max.', messages: 'Zprávy', noProblems: 'Nebyly zjištěny žádné problémy.', quantity: 'Počet', weightPer: 'Hmotnost', addWeightGroup: 'Přidat hmotnostní skupinu', decrease: 'Snížit počet', increase: 'Zvýšit počet', remove: 'Odstranit skupinu', filledTitle: 'Vozidlo naplněno', filledDescription: 'Volný prostor byl vyplněn paletami {type}.',
  },
  uk: {
    title: 'Калькулятор вантажного простору', subtitle: 'Візуалізація розміщення палет за європейськими стандартами', truckType: 'Тип транспорту:', reset: 'Скинути все',
    dinPallets: 'Промислові палети (DIN)', euroPallets: 'Європалети (EUP)', fillDin: 'Заповнити залишок DIN', fillEup: 'Заповнити залишок EUP',
    stackable: 'Штабелювання (2 яруси)', stackLimit: 'Палети для штабелювання (0 = усі)', loadingPattern: 'Схема завантаження EUP:', selected: 'Вибрано', none: 'Немає',
    stackingStrategy: 'Стратегія штабелювання', stackOnlyWhenRequired: 'Штабелювати лише за потреби', forceStacking: 'Примусове штабелювання',
    auto: 'Автоматична оптимізація', long: 'Поздовжньо (3 поруч)', broad: 'Поперечно (2 поруч)', visualization: 'Візуалізація вантажного простору', unit: 'Секція', front: 'Передня частина', empty: 'Немає палет для відображення.',
    loaded: 'Завантажені палети (візуально)', industrial: 'Промислові (DIN)', euro: 'Євро (EUP)', base: 'Місця на підлозі', remaining: 'Залишкова місткість', roomFor: 'Місце для:', more: 'ще', or: 'або', pallet: 'палети', pallets: 'палет',
    weight: 'Орієнтовна вага', max: 'Макс.', messages: 'Повідомлення', noProblems: 'Проблем не виявлено.', quantity: 'Кількість', weightPer: 'Вага', addWeightGroup: 'Додати вагову групу', decrease: 'Зменшити кількість', increase: 'Збільшити кількість', remove: 'Видалити групу', filledTitle: 'Транспорт заповнено', filledDescription: 'Вільний простір заповнено палетами {type}.',
  },
} as const;

export type TranslationKey = keyof typeof translations.de;

export function translateWarning(warning: string, locale: Locale): string {
  if (locale === 'de') return warning;
  const localized = {
    gsw: ['S Gwichtslimit isch erreicht.', 'Info: Uf em Bahnwage cha mer nöd staple; drum ischs abgstellt.', 'ACHTUNG – meh als 10,5 t ligged uf weniger als 40% vo de Ladeflächi.', 'Nöd alli Palettli händ Platz gha. Übrig: ', ' und ', 'ACHTUNG – villicht isch d Achslast z hoch: '],
    fr: ['Limite de poids atteinte.', 'Information : l\'empilage est impossible sur les wagons et a été désactivé.', 'ATTENTION – plus de 10,5 t sont concentrées sur moins de 40 % du plancher de chargement.', 'Toutes les palettes n\'ont pas pu être chargées. Restantes : ', ' et ', 'ATTENTION – risque de dépassement de la charge par essieu : '],
    en: ['Weight limit reached.', 'Info: stacking is not possible on rail wagons and was disabled.', 'WARNING – more than 10.5 t is concentrated on less than 40% of the load floor.', 'Not all pallets could be loaded. Remaining: ', ' and ', 'WARNING – possible axle-load exceedance: '],
    it: ['Limite di peso raggiunto.', 'Info: sui carri ferroviari non è possibile impilare; la funzione è stata disattivata.', 'ATTENZIONE – oltre 10,5 t sono concentrate su meno del 40% del piano di carico.', 'Non è stato possibile caricare tutti i pallet. Rimanenti: ', ' e ', 'ATTENZIONE – possibile superamento del carico per asse: '],
    hr: ['Dosegnuto je ograničenje težine.', 'Info: slaganje na željezničkim vagonima nije moguće i isključeno je.', 'UPOZORENJE – više od 10,5 t nalazi se na manje od 40% utovarne površine.', 'Nije moguće utovariti sve palete. Preostalo: ', ' i ', 'UPOZORENJE – moguće prekoračenje osovinskog opterećenja: '],
    sk: ['Bol dosiahnutý hmotnostný limit.', 'Info: stohovanie na železničných vozňoch nie je možné a bolo vypnuté.', 'UPOZORNENIE – viac ako 10,5 t je sústredených na menej ako 40% ložnej plochy.', 'Nepodarilo sa naložiť všetky palety. Zostáva: ', ' a ', 'UPOZORNENIE – možné prekročenie zaťaženia nápravy: '],
    cs: ['Byl dosažen hmotnostní limit.', 'Info: stohování na železničních vozech není možné a bylo vypnuto.', 'UPOZORNĚNÍ – více než 10,5 t je soustředěno na méně než 40% ložné plochy.', 'Nepodařilo se naložit všechny palety. Zbývá: ', ' a ', 'UPOZORNĚNÍ – možné překročení zatížení nápravy: '],
    uk: ['Досягнуто обмеження ваги.', 'Інформація: штабелювання у залізничних вагонах неможливе й було вимкнене.', 'УВАГА – понад 10,5 т зосереджено на менш ніж 40% вантажної площі.', 'Не вдалося завантажити всі палети. Залишилось: ', ' і ', 'УВАГА – можливе перевищення навантаження на вісь: '],
  };
  const text = localized[locale];
  const exact: Record<string, string> = {
    'Gewichtslimit erreicht.': text[0],
    'Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.': text[1],
    'ACHTUNG – mehr als 10.5t auf weniger als 40% der Ladefläche': text[2],
  };
  if (exact[warning]) return exact[warning];
  return warning
    .replace(/Die maximale Kapazität des Waggons von (\d+) EUP wurde überschritten\. (\d+) Palette\(n\) konnten nicht geladen werden\./, 'The wagon capacity of $1 EUP was exceeded. $2 pallet(s) could not be loaded.')
    .replace(/Konnte nicht alle Paletten laden\. Übrig: /, text[3])
    .replace(/ und /g, text[4])
    .replace(/Für diesen Auftrag werden (\d+) volle LKWs benötigt\./, 'This order requires $1 full trucks.')
    .replace(/Benötigt (\d+) LKWs: (\d+) volle LKW\(s\) und 1 LKW mit (\d+) Paletten\./, 'Requires $1 trucks: $2 full truck(s) and 1 truck with $3 pallets.')
    .replace(/maximale DIN-Kapazität ist (\d+)\. Angeforderte Menge (\d+), es werden (\d+) platziert\./, 'maximum DIN capacity is $1. $2 requested; $3 will be placed.')
    .replace(/ACHTUNG – mögliche Achslastüberschreitung: /, text[5])
    .replace(/ACHTUNG - ACHSLAST bei (DIN|EUP) im AUGE BEHALTEN! \((\d+) gestapelte (DIN|EUP)\)/, 'WARNING – monitor axle load for $1! ($2 stacked $3)');
}
