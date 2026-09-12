import type { Building } from "./generation";

type Box = (material: number, w: number, h: number, d: number, x: number, y: number, z: number) => void;
type Solid = (x: number, y: number, z: number, w: number, h: number, d: number) => void;
const WALL = 0.35;
const FLOOR = 0.12;

// Geometry and physics consume the same walls, including off-centre entrances.
export function buildBuildingShell(b: Building, add: Box, solid: Solid) {
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number, material = 3 + b.color) => {
    if (w <= 0 || h <= 0 || d <= 0) return;
    add(material, w, h, d, x, y, z);
    solid(x, y, z, w, h, d);
  };
  const front = b.z - b.d / 2, rear = b.z + b.d / 2;
  const west = b.x - b.w / 2, east = b.x + b.w / 2;
  wall(b.w - WALL * 2, FLOOR, b.d - WALL * 2, b.x, FLOOR / 2, b.z);
  wall(b.w + 0.5, 0.22, b.d + 0.5, b.x, b.h + 0.2, b.z, 10);
  if (b.entrance) {
    const e = b.entrance, left = b.x + e.x - e.w / 2, right = b.x + e.x + e.w / 2;
    wall(left - west, b.h, WALL, (west + left) / 2, b.h / 2 + FLOOR, front + WALL / 2);
    wall(east - right, b.h, WALL, (right + east) / 2, b.h / 2 + FLOOR, front + WALL / 2);
    wall(e.w, b.h - e.h, WALL, b.x + e.x, FLOOR + e.h + (b.h - e.h) / 2, front + WALL / 2);
  } else {
    wall(b.w, b.h, WALL, b.x, b.h / 2 + FLOOR, front + WALL / 2);
  }
  wall(b.w, b.h, WALL, b.x, b.h / 2 + FLOOR, rear - WALL / 2);
  wall(WALL, b.h, b.d - WALL * 2, west + WALL / 2, b.h / 2 + FLOOR, b.z);
  wall(WALL, b.h, b.d - WALL * 2, east - WALL / 2, b.h / 2 + FLOOR, b.z);
}

// Old facade kits may cross an entrance (glass, window frames, decorative doors).
// Trim their boxes to the same opening instead of leaving invisible walk-through doors.
export function addFacadeBox(b: Building, add: Box, m: number, w: number, h: number, d: number, x: number, y: number, z: number) {
  const e = b.entrance, front = b.z - b.d / 2;
  if (!e || z + d / 2 < front - 0.5 || z - d / 2 > front + WALL) {
    add(m, w, h, d, x, y, z); return;
  }
  const left = Math.max(x - w / 2, b.x + e.x - e.w / 2 - 0.03);
  const right = Math.min(x + w / 2, b.x + e.x + e.w / 2 + 0.03);
  const bottom = Math.max(y - h / 2, FLOOR), top = Math.min(y + h / 2, FLOOR + e.h + 0.03);
  if (left >= right || bottom >= top) { add(m, w, h, d, x, y, z); return; }
  const piece = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 - x0 > 0.001 && y1 - y0 > 0.001) add(m, x1 - x0, y1 - y0, d, (x0 + x1) / 2, (y0 + y1) / 2, z);
  };
  piece(x - w / 2, left, y - h / 2, y + h / 2);
  piece(right, x + w / 2, y - h / 2, y + h / 2);
  piece(left, right, y - h / 2, bottom);
  piece(left, right, top, y + h / 2);
}
