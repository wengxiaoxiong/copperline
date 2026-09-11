import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateBlock,
  hashSeed,
  chunkAt,
  BLOCK,
  segmentDistanceSquared,
} from "../src/generation.ts";
import { WeaponState } from "../src/combat.ts";
import R from "@dimforge/rapier3d-compat";
test("seeded blocks regenerate identically independent of visit order", () => {
  const seed = hashSeed("COPPER-1987"),
    first = generateBlock(seed, -12, 31);
  generateBlock(seed, 4, 6);
  assert.deepEqual(first, generateBlock(seed, -12, 31));
  assert.notDeepEqual(
    first.buildings,
    generateBlock(hashSeed("other"), -12, 31).buildings,
  );
});
test("road corridors stay free and coins remain in reachable road lanes across signed coordinates", () => {
  const ids = new Set();
  for (let x = -10; x <= 10; x++)
    for (let z = -10; z <= 10; z++) {
      const block = generateBlock(87, x, z);
      for (const b of block.buildings) {
        assert.ok(b.x - b.w / 2 > 9 && b.x + b.w / 2 < 63);
        assert.ok(b.z - b.d / 2 > 9 && b.z + b.d / 2 < 63);
      }
      for (const c of block.coins) {
        assert.ok(c.x === 4 || c.z === 4);
        assert.ok(!ids.has(c.id));
        ids.add(c.id);
      }
    }
  assert.deepEqual(chunkAt(-0.01, -BLOCK), { x: -1, z: -1 });
});
test("swept pickup catches coins between high speed frame endpoints", () => {
  assert.equal(segmentDistanceSquared(4, 50, 4, 40, 4, 60), 0);
  assert.ok(segmentDistanceSquared(7, 50, 4, 40, 4, 60) > 1.9 ** 2);
  assert.equal(segmentDistanceSquared(4, 50, 4, 40, 4, 40), 100);
});
test("weapon cadence, reload guards, empty magazine and pause-safe simulation", () => {
  const w = new WeaponState();
  assert.equal(w.reload(), false);
  assert.equal(w.fire(), true);
  assert.equal(w.fire(), false);
  assert.equal(w.ammo, 29);
  w.update(0.11);
  assert.equal(w.fire(true), false);
  assert.equal(w.reload(), true);
  assert.equal(w.reload(), false);
  assert.equal(w.fire(), false);
  w.update(2.1);
  assert.equal(w.ammo, 30);
  for (let i = 0; i < 30; i++) {
    assert.equal(w.fire(), true);
    w.update(0.11);
  }
  assert.equal(w.ammo, 0);
  assert.equal(w.fire(), false);
  assert.ok(w.reloadTime > 0);
  w.update(2.1);
  assert.equal(w.ammo, 30);
});
test("Rapier CCD stops a fast vehicle at a building wall", async () => {
  await R.init();
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const wall = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(0, 1, 0),
  );
  world.createCollider(R.ColliderDesc.cuboid(4, 3, 0.5), wall);
  const car = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(0, 1, 6).setCcdEnabled(true),
  );
  world.createCollider(R.ColliderDesc.cuboid(1, 0.8, 2).setMass(1000), car);
  for (let i = 0; i < 60; i++) {
    car.setLinvel({ x: 0, y: 0, z: -32 }, true);
    world.step();
  }
  assert.ok(
    car.translation().z > 2.3,
    `car crossed wall: ${car.translation().z}`,
  );
  world.free();
});
