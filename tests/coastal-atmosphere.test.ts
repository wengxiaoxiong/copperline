import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { CoastalAtmosphere, coastalArrival, coastalWater } from "../src/coastal-atmosphere.ts";
import { worldPlan, hashSeed } from "../src/generation.ts";

test("coastal arrival stays on a non-bridge road across seeds", () => {
  for (const seed of ["PALM-GROVE-2026", "COPPERLINE", "OCEAN", "123"]) {
    const plan = worldPlan(hashSeed(seed)), p = coastalArrival(plan);
    assert.ok(Math.abs(p.z - plan.coastAt(p.x)) < 65);
    assert.ok(plan.nearestRoad(p.x, p.z).distance < .001);
    assert.equal(plan.isWater(p.x, p.z), false);
    assert.ok(Number.isFinite(p.yaw));
    assert.deepEqual(coastalArrival(plan), p);
  }
});

test("atmosphere follows camera and logical origin without accumulating resources", () => {
  const scene = new T.Scene(), atmosphere = new CoastalAtmosphere(scene);
  const camera = new T.PerspectiveCamera();
  camera.position.set(20, 6, -50);
  atmosphere.update(camera, 12, new T.Vector3(1512, 0, 0));
  assert.deepEqual(atmosphere.sky.position.toArray(), [20, 6, -50]);
  assert.equal(coastalWater.uniforms.time.value, 12);
  assert.deepEqual(coastalWater.uniforms.origin.value.toArray(), [1512, 0, 0]);
  atmosphere.update(camera, 0, new T.Vector3());
  assert.equal(scene.children.length, 1);
  assert.equal(atmosphere.sky.castShadow, false);
  assert.equal(atmosphere.sky.material.depthWrite, false);
  atmosphere.dispose();
  assert.equal(scene.children.length, 0);
});
