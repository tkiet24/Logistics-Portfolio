export const SCENERY_PACKS = {
  vehicle: "car-kit",
  city: "city-kit-commercial_2.1",
};

// Items: pack, model, local x/z, longest footprint, yaw, optional stack.
// Sites sit behind Skills, west of the Work road entrance. The railway's
// eastern bend/exit at x=68 and the Work/Contact transition remain clear.
export const SCENERY_SITES = [
  {
    name: "Skills parking lot",
    kind: "parking",
    x: 76,
    z: -8,
    size: [12, 9],
    parking: { columns: 5, bayWidth: 2, bayDepth: 2.8, rowZ: 2.8 },
    items: [
      ["vehicle", "sedan-sports", -4, -2.8, 1.8, 0],
      ["vehicle", "van", 2, 2.8, 1.9, Math.PI],
      ["vehicle", "delivery-flat", 2, -2.8, 2, 0],
      ["vehicle", "sedan-sports", -2, 2.8, 1.8, Math.PI],
      ["vehicle", "van", -2, -2.8, 1.9, 0],
      ["vehicle", "truck", 4, 2.8, 2, Math.PI],
      ["vehicle", "sedan-sports", 4, -2.8, 1.8, 0],
      ["vehicle", "delivery-flat", -4, 2.8, 2, Math.PI],
    ],
  },
  {
    name: "Skills to Work city",
    kind: "city",
    x: 89,
    z: -8,
    size: [10, 10],
    // First four entries preserve buildings and traffic on mobile as well.
    items: [
      ["city", "building-a", -3.2, 3.3, 2.2, Math.PI],
      ["city", "building-skyscraper-b", 0, -3.3, 2.2, 0],
      ["vehicle", "sedan-sports", -2.8, 0.65, 1.7, Math.PI / 2],
      ["vehicle", "van", 2.8, -0.65, 1.8, -Math.PI / 2],
      ["city", "building-d", 0, 3.3, 2.2, Math.PI],
      ["city", "building-h", 3.2, 3.3, 2.2, Math.PI],
      ["city", "building-b", -3.2, -3.3, 2.2, 0],
      ["city", "building-skyscraper-a", 3.2, -3.3, 2.2, 0],
      ["vehicle", "delivery-flat", 0.2, 0.65, 1.8, Math.PI / 2],
    ],
  },
];
