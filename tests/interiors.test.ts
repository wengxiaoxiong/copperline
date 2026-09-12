import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInterior } from "../src/interiors.ts";
import type { Building } from "../src/generation.ts";

test("interior layouts stay inside the building footprint and leave corridors open", () => {
  const building = (style: Building["style"], w: number, d: number, h: number): Building => ({
    x: 0, y: 0, z: 0, w, d, h, yaw: 0, color: 2, shop: style === "shop", style,
    entrance: style === "warehouse" ? undefined : { x: 0, z: -d / 2, w: 2.0, h: 2.2 },
  });

  for (const style of ["house", "shop", "apartment"] as const) {
    const b = building(style, style === "apartment" ? 18 : 16, style === "apartment" ? 14 : 12, style === "apartment" ? 15 : style === "shop" ? 7 : 5);
    const boxes: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    const solids: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    const lights = buildInterior(b,
      (_m, w, h, d, x, y, z) => boxes.push({ x, y, z, w, h, d }),
      (x, y, z, w, h, d) => solids.push({ x, y, z, w, h, d }),
    );
    assert.ok(lights.length > 0, `${style} must have interior lights`);
    for (const s of solids) {
      const halfW = s.w / 2, halfD = s.d / 2;
      assert.ok(Math.abs(s.x) + halfW <= b.w / 2 + 0.05, `${style} solid exceeds building width`);
      assert.ok(Math.abs(s.z) + halfD <= b.d / 2 + 0.05, `${style} solid exceeds building depth`);
      assert.ok(s.y + s.h / 2 <= b.h + 0.2, `${style} solid exceeds building height`);
      assert.ok(s.y - s.h / 2 >= -0.1, `${style} solid below ground`);
    }
    // The doorway area at the front facade must remain free of colliders.
    const doorHalf = 1.0;
    for (const s of solids) {
      const dz = Math.abs(s.z - (-b.d / 2));
      if (dz > 0.3) continue;
      const overlapX = Math.max(0, Math.min(s.x + s.w / 2, doorHalf) - Math.max(s.x - s.w / 2, -doorHalf));
      const overlapY = Math.max(0, Math.min(s.y + s.h / 2, 2.1) - Math.max(s.y - s.h / 2, 0));
      assert.ok(overlapX < 0.01 || overlapY < 0.01, `${style} blocks the doorway`);
    }
    // Houses and apartments also have interior partition doorways that must stay open.
    if (style === "house" || style === "apartment") {
      const halfD = b.d / 2 - 0.35;
      const partitionZ = style === "house" ? halfD - 3.6 : halfD - 1.6;
      const innerDoorHalf = 0.9;
      for (const s of solids) {
        const dz = Math.abs(s.z - partitionZ);
        if (dz > 0.15) continue;
        const overlapX = Math.max(0, Math.min(s.x + s.w / 2, innerDoorHalf) - Math.max(s.x - s.w / 2, -innerDoorHalf));
        const overlapY = Math.max(0, Math.min(s.y + s.h / 2, 2.1) - Math.max(s.y - s.h / 2, 0));
        assert.ok(overlapX < 0.01 || overlapY < 0.01, `${style} blocks the interior partition doorway`);
      }
    }
  }
});

test("warehouse does not generate interior details", () => {
  const b: Building = { x: 0, y: 0, z: 0, w: 26, d: 20, h: 8, yaw: 0, color: 0, shop: false, style: "warehouse" };
  const solids: unknown[] = [];
  const lights = buildInterior(b, () => {}, (...args) => solids.push(args));
  assert.equal(lights.length, 0);
  assert.equal(solids.length, 0);
});
