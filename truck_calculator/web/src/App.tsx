import React from 'react';
import { computeAxleLoadPerMeter } from '@rep0mancer/engine';

export function App() {
  const axlePerM = computeAxleLoadPerMeter(25000, 10);
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Truck Calculator</h1>
      <p>Axle load per meter for 25,000 kg over 10 m: {axlePerM} kg/m</p>
    </div>
  );
}