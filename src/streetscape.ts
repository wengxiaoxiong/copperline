import { buildBlockInterior } from "./block-details";
import type { Parcel } from "./parcels";

type Box = (material: number, w: number, h: number, d: number, x: number, y: number, z: number) => void;
type Solid = (x: number, y: number, z: number, w: number, h: number, d: number) => void;

// Uses the same plot-local placement as buildings. City owns batches, colliders
// and resources, so these pieces unload and shift with their owning parcel.
export function buildStreetscape(p: Parcel, add: Box, solid: Solid, palm: (x: number, z: number, height: number) => void) {
  if (p.infill) { buildBlockInterior(p, add, solid, palm); return; }
  const x = p.x, z = p.z, front = z - p.d / 2, rear = z + p.d / 2;
  const housing = p.use === "housing", parking = p.use === "parking", yard = p.use === "yard";
  add(housing ? 17 : parking || yard ? 18 : 1, p.w, 0.5, p.d, x, -0.25, z);
  solid(x, -0.25, z, p.w, 0.5, p.d);
  const wall = (w: number, d: number, wx: number, wz: number) => {
    add(1, w, 0.7, d, wx, 0.35, wz);
    add(10, w + 0.06, 0.08, d + 0.06, wx, 0.74, wz);
    solid(wx, 0.38, wz, w, 0.76, d);
  };
  const planter = (px: number, pz: number) => {
    add(1, 2.3, 0.35, 2.3, px, 0.18, pz);
    add(17, 1.9, 0.06, 1.9, px, 0.38, pz);
    solid(px, 0.2, pz, 2.3, 0.4, 2.3);
    palm(px, pz, 7.5 + (p.along % 3));
  };
  if (housing) {
    // A continuous pavement edge, an open front gate and a driveway to the side.
    add(1, p.w, 0.06, 2.2, x, 0.025, front + 1.1);
    const driveX = x + p.w / 2 - 3.7;
    add(1, 4.7, 0.06, p.d - 5, driveX, 0.03, z - 2.5);
    add(1, 2, 0.07, 8, x - 2.1, 0.045, front + 4);
    wall(p.w, 0.25, x, rear - 0.2);
    wall(0.25, p.d - 3, x - p.w / 2 + 0.2, z + 1.3);
    wall(0.25, p.d - 3, x + p.w / 2 - 0.2, z + 1.3);
    const leftWidth = p.w / 2 - 4;
    wall(leftWidth, 0.25, x - p.w / 2 + leftWidth / 2, front + 2.7);
    wall(3.6, 0.25, x + 1.5, front + 2.7);
    add(11, p.w - 2, 0.85, 1.1, x, 0.65, rear - 1);
    planter(x - p.w / 2 + 3, front + 5.3);
    add(15, 0.12, 1.2, 0.12, driveX - 3, 0.6, front + 1.5);
    add(13, 0.6, 0.35, 0.4, driveX - 3, 1.22, front + 1.5);
  } else if (parking) {
    // Two banks of marked bays, a central aisle, and an open street entrance.
    const count = Math.floor((p.w - 3) / 2.8);
    for (const row of [front + 8, rear - 6]) {
      for (let i = 0; i <= count; i++) add(10, 0.09, 0.035, 5.2, x - count * 1.4 + i * 2.8, 0.025, row);
      add(10, count * 2.8, 0.035, 0.09, x, 0.025, row + 2.6);
      for (let i = 0; i < count; i++) {
        const bx = x - count * 1.4 + i * 2.8 + 1.4;
        add(1, 1.6, 0.12, 0.22, bx, 0.06, row + 2.1);
      }
    }
    wall(p.w, 0.25, x, rear - 0.15);
    planter(x - p.w / 2 + 1.5, front + 2);
    add(15, 0.14, 3.1, 0.14, x + p.w / 2 - 1, 1.55, front + 1);
    add(9, 1.2, 0.8, 0.12, x + p.w / 2 - 1, 2.8, front + 1);
  } else if (yard) {
    // Loading apron and bay stripes in front of the warehouse.
    for (let i = -2; i <= 2; i++) add(14, 0.12, 0.04, 9, x + i * 4, 0.03, front + 6);
    wall(p.w, 0.3, x, rear - 0.2);
    for (const side of [-1, 1]) {
      add(14, 0.3, 1.1, 0.3, x + side * 9, 0.55, front + 11);
      solid(x + side * 9, 0.55, front + 11, 0.3, 1.1, 0.3);
    }
  } else {
    // Paving joints and restrained furnishings make the frontage a shared walk.
    for (let offset = -p.w / 2 + 2; offset < p.w / 2; offset += 2.5)
      add(19, 0.025, 0.02, 3.8, x + offset, 0.025, front + 1.9);
    add(19, p.w, 0.025, 0.025, x, 0.03, front + 2);
    const bx = x + p.w / 2 - 3.2, bz = front + 1.3;
    if (!p.building?.venue) {
    add(13, 2.2, 0.14, 0.6, bx, 0.52, bz);
    add(13, 2.2, 0.65, 0.1, bx, 0.91, bz + 0.28);
    for (const side of [-1, 1]) add(15, 0.12, 0.5, 0.5, bx + side * 0.8, 0.25, bz);
    solid(bx, 0.6, bz, 2.2, 1.2, 0.65);
    }
    add(15, 0.6, 0.95, 0.6, x - p.w / 2 + 1.2, 0.48, front + 1.2);
    planter(x, rear - 3);
    wall(p.w, 0.25, x, rear - 0.2);
  }
}
