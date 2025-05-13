// src/containerSlots.js
export const CONTAINER_SLOT_DEFINITIONS = {
  container20ft: {
    euro: [
      { x:   0, y:   0, width: 120, height: 80 },
      { x:   0, y:  80, width: 120, height: 80 },
      { x:   0, y: 160, width: 120, height: 80 },
      { x: 120, y:   0, width: 120, height: 80 },
      { x: 120, y:  80, width: 120, height: 80 },
      { x: 120, y: 160, width: 120, height: 80 },
      { x: 240, y:   0, width: 120, height: 80 },
      { x: 240, y:  80, width: 120, height: 80 },
      { x: 240, y: 160, width: 120, height: 80 },
      { x: 360, y:   0, width:  80, height:120 },
      { x: 360, y: 120, width:  80, height:120 },
    ],
    industrial: [
      ...Array.from({ length: 5 }, (_, i) => ({
        x: i * 120, y:   0, width: 120, height: 100
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        x: i * 120, y: 100, width: 120, height: 100
      })),
    ]
  },
  container40ft: {
    euro: [
      ...Array.from({ length: 8 }, (_, row) =>
        [0, 80, 160].map(col => ({
          x: row * 120, y: col, width: 120, height: 80
        }))
      ).flat()
    ],
    industrial: [
      ...Array.from({ length: 10 }, (_, row) =>
        [0, 100].map(col => ({
          x: row * 120, y: col, width: 120, height: 100
        }))
      ).flat(),
      { x: 10 * 120, y: 0, width: 120, height: 100 }
    ]
  }
};
