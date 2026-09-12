import { buildFoodInterior } from "./venue-interiors";
import type { Building } from "./generation";

type Box = (
  material: number,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) => void;
type Solid = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) => void;

const WALL = 0.35;

export function buildInterior(
  b: Building,
  add: Box,
  solid: Solid,
): { x: number; y: number; z: number; color: number }[] {
  const lights: { x: number; y: number; z: number; color: number }[] = [];
  const halfW = b.w / 2 - WALL;
  const halfD = b.d / 2 - WALL;
  const floor = 0.12;
  const ceil = b.h - 0.08;

  // Indoor floor and ceiling planes use a warmer material than the facade.
  add(7, halfW * 2, 0.06, halfD * 2, 0, floor, 0);

  if (b.venue === "cafe" || b.venue === "burger" || b.venue === "diner") return buildFoodInterior(b, add, solid);

  if (b.style === "house") {
    // Rear bedroom partition with a central doorway.
    const partitionZ = halfD - 3.6;
    const doorHalf = 0.9;
    // Doorway opening: no colliders in [-doorHalf, doorHalf].
    // Left/right of door.
    const sideW = halfW - doorHalf - 0.1;
    if (sideW > 0.2) {
      add(1, sideW, ceil - 0.3, 0.2, -halfW + sideW / 2, ceil / 2, partitionZ);
      solid(-halfW + sideW / 2, ceil / 2, partitionZ, sideW, ceil - 0.3, 0.2);
      add(1, sideW, ceil - 0.3, 0.2, halfW - sideW / 2, ceil / 2, partitionZ);
      solid(halfW - sideW / 2, ceil / 2, partitionZ, sideW, ceil - 0.3, 0.2);
    }
    // Lintel above door.
    const lintelH = ceil - 2.2;
    add(1, doorHalf * 2 + 0.1, lintelH, 0.2, 0, 2.1 + lintelH / 2, partitionZ);
    solid(0, 2.1 + lintelH / 2, partitionZ, doorHalf * 2 + 0.1, lintelH, 0.2);

    // Living room furniture.
    add(12, 2.6, 0.55, 1.4, -2.2, 0.39, partitionZ - 2.0);
    solid(-2.2, 0.39, partitionZ - 2.0, 2.6, 0.55, 1.4);
    add(13, 1.6, 0.65, 0.65, 1.6, 0.41, partitionZ - 2.3);
    solid(1.6, 0.41, partitionZ - 2.3, 1.6, 0.65, 0.65);
    // Kitchen counter along the side wall.
    add(10, 0.55, 0.95, halfD * 1.6, halfW - 0.32, 0.55, 0);
    solid(halfW - 0.32, 0.55, 0, 0.55, 0.95, halfD * 1.6);
    // Small dining table.
    add(12, 1.4, 0.5, 1.4, 1.0, 0.37, 0.8);
    solid(1.0, 0.37, 0.8, 1.4, 0.5, 1.4);
    // Bed in the rear bedroom.
    add(3 + b.color, 1.9, 0.6, 2.5, 0, 0.4, halfD - 1.6);
    solid(0, 0.4, halfD - 1.6, 1.9, 0.6, 2.5);
    // Tall floor lamp and a potted plant for vertical interest.
    add(14, 0.18, 2.4, 0.18, -halfW + 1.0, 1.35, -halfD + 1.6);
    solid(-halfW + 1.0, 1.35, -halfD + 1.6, 0.18, 2.4, 0.18);
    add(11, 0.55, 1.3, 0.55, halfW - 1.0, 0.8, -halfD + 2.0);
    solid(halfW - 1.0, 0.8, -halfD + 2.0, 0.55, 1.3, 0.55);
    // Hanging pendant over the dining table.
    add(14, 0.35, 0.08, 0.35, 1.0, ceil - 0.5, 0.8);

    lights.push({ x: 0, y: ceil - 0.35, z: -1.5, color: 0xffe8c9 });
    lights.push({ x: 0, y: ceil - 0.35, z: halfD - 1.8, color: 0xffe8c9 });
  } else if (b.style === "shop") {
    // Rear stock wall with a service doorway.
    const rearZ = halfD - 1.2;
    const doorHalf = 0.85;
    const sideW = halfW - doorHalf - 0.1;
    if (sideW > 0.2) {
      add(1, sideW, b.h - 0.5, 0.18, -halfW + sideW / 2, b.h / 2, rearZ);
      add(1, sideW, b.h - 0.5, 0.18, halfW - sideW / 2, b.h / 2, rearZ);
      solid(-halfW + sideW / 2, b.h / 2, rearZ, sideW, b.h - 0.5, 0.18);
      solid(halfW - sideW / 2, b.h / 2, rearZ, sideW, b.h - 0.5, 0.18);
    }

    // Shelving aisles, taller and thicker so they read from a distance.
    for (const z of [-2.0, 0.6]) {
      add(10, 0.35, 2.0, 2.4, -halfW + 1.1, 1.1, z);
      add(10, 0.35, 2.0, 2.4, halfW - 1.1, 1.1, z);
      solid(-halfW + 1.1, 1.1, z, 0.35, 2.0, 2.4);
      solid(halfW - 1.1, 1.1, z, 0.35, 2.0, 2.4);
      // Items on shelves.
      for (const sx of [-halfW + 1.1, halfW - 1.1]) {
        add(14, 0.6, 0.25, 0.32, sx + 0.22, 1.4, z - 0.7);
        add(15, 0.4, 0.22, 0.4, sx + 0.22, 1.4, z + 0.6);
      }
      // Overhead strip light for each aisle.
      add(14, 0.12, 0.1, 2.2, -halfW + 1.1, ceil - 0.25, z);
      add(14, 0.12, 0.1, 2.2, halfW - 1.1, ceil - 0.25, z);
    }
    // Counter at the rear leaves every generated street entrance clear.
    add(12, halfW * 1.6, 0.9, 0.7, 0, 0.57, rearZ - 2);
    solid(0, 0.57, rearZ - 2, halfW * 1.6, 0.9, 0.7);
    // A bright vending machine near the entrance.
    add(9, 0.8, 1.8, 0.55, -halfW + 0.8, 1.0, -halfD + 1.2);
    solid(-halfW + 0.8, 1.0, -halfD + 1.2, 0.8, 1.8, 0.55);

    lights.push({ x: 0, y: ceil - 0.35, z: -1.0, color: 0xfff3d6 });
    lights.push({ x: 0, y: ceil - 0.35, z: 1.2, color: 0xfff3d6 });
  } else if (b.style === "apartment") {
    // Ground-floor lobby / corridor with a central doorway.
    const lobbyZ = halfD - 1.6;
    const doorHalf = 0.9;
    const sideW = halfW - doorHalf - 0.1;
    if (sideW > 0.2) {
      add(1, sideW, ceil - 0.3, 0.25, -halfW + sideW / 2, ceil / 2, lobbyZ);
      solid(-halfW + sideW / 2, ceil / 2, lobbyZ, sideW, ceil - 0.3, 0.25);
      add(1, sideW, ceil - 0.3, 0.25, halfW - sideW / 2, ceil / 2, lobbyZ);
      solid(halfW - sideW / 2, ceil / 2, lobbyZ, sideW, ceil - 0.3, 0.25);
    }
    const lintelH = ceil - 2.2;
    add(1, doorHalf * 2 + 0.1, lintelH, 0.25, 0, 2.1 + lintelH / 2, lobbyZ);
    solid(0, 2.1 + lintelH / 2, lobbyZ, doorHalf * 2 + 0.1, lintelH, 0.25);
    // Mailboxes and a bench.
    add(10, 1.8, 1.4, 0.25, -halfW + 1.2, 0.8, halfD - 0.25);
    solid(-halfW + 1.2, 0.8, halfD - 0.25, 1.8, 1.4, 0.25);
    add(12, 1.6, 0.55, 0.55, halfW - 1.2, 0.42, halfD - 0.5);
    solid(halfW - 1.2, 0.42, halfD - 0.5, 1.6, 0.55, 0.55);
    // Large potted plant in the lobby corner.
    add(11, 0.7, 1.6, 0.7, -halfW + 1.0, 1.0, -halfD + 1.5);
    solid(-halfW + 1.0, 1.0, -halfD + 1.5, 0.7, 1.6, 0.7);

    // Stairwell at the rear leaves off-centre street entrances clear.
    add(10, 2.0, 0.18, 3.2, halfW - 1.3, 0.2, halfD - 3.8);
    add(10, 2.0, 0.18, 3.2, halfW - 1.3, 1.2, halfD - 3.8);
    add(10, 2.0, 0.18, 3.2, halfW - 1.3, 2.2, halfD - 3.8);
    solid(halfW - 1.3, 1.1, halfD - 3.8, 2.0, 2.2, 3.2);
    // Stair railing.
    add(14, 0.08, 1.0, 3.0, halfW - 2.4, 1.3, halfD - 3.8);
    solid(halfW - 2.4, 1.3, halfD - 3.8, 0.08, 1.0, 3.0);

    lights.push({ x: 0, y: ceil - 0.35, z: 0, color: 0xf2f8ff });
  }

  return lights;
}
