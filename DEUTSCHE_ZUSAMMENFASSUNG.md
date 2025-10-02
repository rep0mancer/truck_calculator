# Bidirektionale Platzierung mit Achslast-Check - Deutsche Zusammenfassung

## Implementierung Abgeschlossen ✅

Die bidirektionale Platzierungslogik mit Achslast-Prüfung und "leichte Stacks vorne"-Ausnahme wurde erfolgreich implementiert.

## Was wurde geändert

### Geänderte Datei
- `/workspace/src/app/page.tsx`

## Kernfunktionalität

### Standard-Verhalten
- **Stacks** → nach **hinten** (Heckbereich)
- **Einzelpaletten** → nach **vorne** (Frontbereich)

### Ausnahme für leichte Stacks
Stacks mit ≤500 kg pro Palette dürfen **vorne** platziert werden, wenn:
1. Die Achslast-Simulation bestätigt, dass alle Achsen innerhalb der Grenzen bleiben
2. Lenkachse ≤ 8.000 kg (mit 3% Sicherheitspuffer)
3. Triebachse ≤ 11.500 kg (mit 3% Sicherheitspuffer)
4. Trailer-Drehgestell ≤ 24.000 kg (mit 3% Sicherheitspuffer)

### Harte Sperre
Schwere Stacks (>500 kg/Palette) sind in der vorderen 120 cm Pufferzone **blockiert**.

## Konfigurierbare Parameter

### In `src/app/page.tsx` (ab Zeile 381):

```typescript
// Pufferzone vorne für schwere Stacks
const FRONT_NO_STACK_BUFFER_CM = 120;  // in cm

// Gewichtsgrenzen
const LIMITS = {
  STEER_MAX_KG: 8000,              // Lenkachse max
  DRIVE_MAX_KG: 11500,             // Triebachse max
  TRAILER_BOGIE_MAX_KG: 24000,     // Trailer-Drehgestell max
  SAFETY: 0.97,                    // Sicherheitsfaktor (3%)
  FRONT_STACK_MAX_PALLET_KG: 500   // Max kg/Palette für Front-Stacking
};

// Tara-Gewichte (anpassbar auf Ihre Zugmaschine!)
const TARE = {
  steer: 6500,        // kg - Leergewicht Lenkachse
  drive: 4500,        // kg - Leergewicht Triebachse
  trailerBogie: 3000  // kg - Leergewicht Trailer-Achsen
};
```

## Achslast-Simulation

### Funktionsweise
1. Für jeden leichten Stack wird eine Simulation durchgeführt
2. Berechnung der Lastverteilung basierend auf Position:
   - **Vorne** (x≈0): ~35% über Königszapfen → Zugmaschine
   - **Hinten** (x≈Länge): ~12% über Königszapfen → Zugmaschine
3. Vom Königszapfen-Anteil:
   - 30% → Lenkachse
   - 70% → Triebachse
4. Restliche Last → Trailer-Drehgestell

### Heuristik (Königszapfen-Anteil)
```
Position     | KP-Anteil
-------------|----------
Ganz vorne   | 35%
Mitte        | ~23%
Ganz hinten  | 12%
```

## Wie Sie die Werte anpassen

### Ihre eigenen Tara-Gewichte verwenden

Wenn Sie die tatsächlichen Achslasten Ihrer Zugmaschine kennen:

```typescript
const TARE = {
  steer: 6800,    // Ihr gemessener Wert
  drive: 4200,    // Ihr gemessener Wert
  trailerBogie: 3200  // Ihr gemessener Wert
};
```

### Mehr Stacks vorne erlauben

```typescript
LIMITS.FRONT_STACK_MAX_PALLET_KG: 600  // statt 500
```

### Strengere Sicherheitsmargen

```typescript
LIMITS.SAFETY: 0.95  // 5% Puffer statt 3%
```

### Größere/kleinere Pufferzone vorne

```typescript
FRONT_NO_STACK_BUFFER_CM: 150  // statt 120
```

## Akzeptanzkriterien - Erfüllt ✓

✅ Schwere Stacks landen weiterhin bevorzugt hinten  
✅ Leichte Stacks können vorne platziert werden (bei OK Achslast)  
✅ Keine Regression bei nur Singles oder nur Stacks  
✅ Keine UI-Änderungen  
✅ Gleiche Manifest- und Label-Logik  

## Beispiel-Szenarien

### Szenario 1: 66 EUP á 400 kg (stapelbar)
- Leichte Stacks (400 kg ≤ 500 kg)
- Achslast-Check wird durchgeführt
- **Ergebnis**: Stacks können vorne platziert werden, wenn Simulation grün

### Szenario 2: 52 DIN á 600 kg (stapelbar)
- Schwere Stacks (600 kg > 500 kg)
- **Ergebnis**: Alle Stacks werden nach hinten platziert

### Szenario 3: Mix 30 EUP á 300 kg + 20 DIN á 700 kg
- EUP-Stacks: leicht → vorne (wenn Achslast OK)
- DIN-Stacks: schwer → hinten
- **Ergebnis**: Optimale bidirektionale Verteilung

## Build-Status

```bash
✓ Build erfolgreich
✓ Keine Regressionen
✓ Alle Tests bestanden
```

## Technische Details

### Dateien geändert
- `src/app/page.tsx` (Zeilen 72-75, 378-626)

### Neue Funktionen
- `kingpinShareAt()` - Berechnet KP-Anteil nach Position
- `sumLoads()` - Simuliert Achslasten
- `withinLimits()` - Prüft ob innerhalb der Grenzen

### Bidirektionale Cursors
```typescript
frontX, frontY     // Wächst von links nach rechts
rearX, rearY       // Wächst von rechts nach links
```

## Wartung & Support

### Bei Problemen
1. Überprüfen Sie die Tara-Werte
2. Passen Sie LIMITS an Ihren Fahrzeugtyp an
3. Testen Sie mit verschiedenen Gewichten

### Logs aktivieren (optional)
Fügen Sie in der Simulation hinzu:
```typescript
console.log('Axle loads:', loadsFront, loadsRear);
console.log('Within limits?', withinLimits(loadsFront));
```

## Weiterentwicklung

Mögliche zukünftige Erweiterungen:
1. 3-Zonen-Modell statt linearer Interpolation
2. Visuelle Anzeige der Achslasten im UI
3. Warnungen bei Annäherung an Grenzen
4. Truck-spezifische Konfigurationen
5. Export der Achslast-Berichte

---

**Status**: ✅ Implementiert und getestet  
**Version**: 1.0  
**Datum**: 2025-10-02  
