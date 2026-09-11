import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import R from '@dimforge/rapier3d-compat';
import { Population, streetCircuit } from '../src/population.ts';
import { generateBlock, districtAt } from '../src/generation.ts';
test('districts include all five layouts and repeat across unloads', () => {
  const kinds = new Set<string>();
  for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) {
    const b = generateBlock(87, x, z); kinds.add(b.district);
    assert.equal(b.district, districtAt(87, x, z));
    assert.equal(b.buildings.length, b.park ? 0 : b.district === "industrial" ? 2 : 4);
    assert.deepEqual(b, generateBlock(87, x, z));
  }
  assert.equal(kinds.size, 5);
});
test('traffic stays on roads and pedestrians stay on the pavement for a full circuit', () => {
  for (let t = -300; t < 600; t += 0.5) {
    const p = streetCircuit(t, 4);
    assert.ok(p.x === 4 || p.x === 68 || p.z === 4 || p.z === 68);
    const q = streetCircuit(t, 10);
    assert.ok(q.x >= 10 && q.x <= 62 && q.z >= 10 && q.z <= 62);
  }
});
test('population moves, brakes, streams with bounded bodies, shifts and resets', async () => {
  await R.init();
  const world = new R.World({x:0,y:0,z:0});
  const crowd = new Population(new T.Scene(), world);
  const zero = new T.Vector3();
  crowd.update(0, zero, zero, 87, []);
  assert.equal(crowd.people.length, 54); assert.equal(crowd.cars.length, 27);
  const car = crowd.cars.find(a => !a.parked)!;
  const before = car.distance;
  const p = streetCircuit(before, 4);
  const blocker = new T.Vector3(car.cx * 72 + p.x - Math.sin(p.yaw) * 5, 0, car.cz * 72 + p.z - Math.cos(p.yaw) * 5);
  crowd.update(0.1, zero, zero, 87, [blocker]);
  assert.equal(car.distance, before);
  for (let i=0;i<120;i++) crowd.update(1/60, zero, zero, 87, []);
  assert.ok(car.distance > before);
  for (let x=1;x<=12;x++) {
    crowd.update(0, new T.Vector3(x*72,0,0), zero, 87, []);
    assert.equal(crowd.cars.length,27); assert.equal(world.bodies.len(),27);
  }
  const body=crowd.cars[0].body!; const old=body.translation().x;
  crowd.shift(new T.Vector3(720,0,0));
  assert.ok(Math.abs(body.translation().x-(old-720))<0.001);
  crowd.reset(); assert.equal(world.bodies.len(),0); assert.equal(crowd.people.length,0);
  world.free();
});
