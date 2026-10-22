export const SCENERY_PACKS = {
  cargo: "watercraft-pack",
  factory: "factory-kit",
  vehicle: "car-kit",
  city: "city-kit-commercial_2.1",
};
// Items: pack, model, local x/z, longest footprint, yaw, optional stack.
// Keep every site behind the road; no random foreground obstructions.
export const SCENERY_SITES = [
  {
    name: "Container yard",
    x: 65,
    z: -8,
    items: [
      ["cargo", "cargo-container-a", -2.4, 0, 2.8, Math.PI / 2, 2],
      ["cargo", "cargo-container-b", 1.1, 0, 2.8, Math.PI / 2],
      ["factory", "box-large", -2.4, 2.4, 0.8, 0, 2],
      ["vehicle", "truck", 1.3, 2.4, 2.4, Math.PI / 2],
      ["factory", "crane", -0.6, -3.3, 2.8, Math.PI],
    ],
  },
  {
    name: "Dispatch depot",
    x: 74,
    z: -11.6,
    items: [
      ["city", "low-detail-building-wide-a", 0, -2.7, 3.4, 0],
      ["vehicle", "delivery-flat", 0, 1.3, 2.5, -Math.PI / 2],
      ["cargo", "cargo-container-c", -3.5, -1.1, 2.4, Math.PI / 2],
      ["factory", "box-wide", 2.6, 1.6, 0.9, 0, 2],
      ["vehicle", "van", 3.6, -2.2, 1.8, Math.PI],
    ],
  },
  {
    name: "Distribution centre",
    x: 93,
    z: -8.5,
    items: [
      ["city", "low-detail-building-wide-b", 0, -2.8, 3.2, 0],
      ["factory", "conveyor-long", 0, 1.8, 2.6, 0],
      ["factory", "scanner-high", 2.8, 1.8, 1, Math.PI / 2],
      ["vehicle", "delivery-flat", -3.8, 1.4, 2.3, 0],
      ["factory", "box-large", -0.8, 3.4, 0.8, 0, 2],
    ],
  },
  {
    name: "Coffee handling facility",
    x: 100.5,
    z: -12,
    items: [
      ["factory", "hopper-high-round", -2.1, -1, 1.3, 0],
      ["factory", "hopper-high-round", 0, -1, 1.3, 0],
      ["factory", "hopper-high-round", 2.1, -1, 1.3, 0],
      ["factory", "conveyor-long", 0, 1.6, 2.6, 0],
      ["factory", "box-wide", 2.6, 1.6, 0.9, 0, 2],
      ["vehicle", "van", -3.2, 2, 2, Math.PI / 2],
    ],
  },
  {
    name: "Freight transfer yard",
    x: 140,
    z: -8.5,
    items: [
      ["cargo", "cargo-container-a", -2.2, 0, 2.6, Math.PI / 2, 2],
      ["cargo", "cargo-container-c", 1.6, 0, 2.6, Math.PI / 2],
      ["factory", "crane", -0.4, -3.4, 2.8, Math.PI],
      ["vehicle", "truck", 0, 2.8, 2.8, -Math.PI / 2],
      ["factory", "box-large", 3, 2.4, 0.8, 0, 2],
    ],
  },
  {
    name: "Local delivery hub",
    x: 150,
    z: -10.5,
    items: [
      ["city", "low-detail-building-wide-a", 0, -2.7, 3.2, 0],
      ["vehicle", "van", -2.8, 1.1, 2, -Math.PI / 2],
      ["vehicle", "delivery-flat", 1, 1.1, 2.5, Math.PI / 2],
      ["factory", "box-large", 3.2, -0.8, 0.8, 0, 2],
      ["factory", "conveyor-long", 0, -0.4, 1.6, 0],
    ],
  },
];
