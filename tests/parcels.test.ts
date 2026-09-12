import { test } from "node:test";
import assert from "node:assert/strict";
import { WorldPlan, BLOCK, chunkAt, generateBlock, hashSeed } from "../src/generation.ts";
import { insidePlot, plotPoint, plotsOverlap } from "../src/parcels.ts";
import { buildStreetscape } from "../src/streetscape.ts";
import R from "@dimforge/rapier3d-compat";
import * as T from "three";

test("frontage parcels face their road, reserve usable plots and never overlap across chunk edges", () => {
  for (const seed of [87, hashSeed("PALM-GROVE-2026"), 4294967295]) {
    const plan = new WorldPlan(seed);
    assert.ok(plan.parcels.length > 300, "city must contain built street frontage");
    assert.deepEqual(new Set(plan.parcels.map(p => p.use)), new Set(["housing", "shops", "apartments", "parking", "yard", "court", "garden", "market", "depot"]));
    for (let i = 0; i < plan.parcels.length; i++) {
      const p = plan.parcels[i], front = plotPoint(p, 0, -p.d / 2), rear = plotPoint(p, 0, p.d / 2);
      const road = plan.sampleRoad(plan.roads[p.road], p.along);
      assert.ok(Math.hypot(front.x - road.x, front.z - road.z) < Math.hypot(rear.x - road.x, rear.z - road.z));
      for (const q of [front, rear, ...[-1, 1].flatMap(x => [-1, 1].map(z => plotPoint(p, x * p.w / 2, z * p.d / 2)))]) {
        assert.ok(!plan.isWater(q.x, q.z), `${p.id} extends into water`);
        const n = plan.nearestRoad(q.x, q.z);
        assert.ok(n.distance > n.road.width / 2 + 2, `${p.id} blocks road or walking lane`);
      }
      if (p.building) {
        for (const x of [-1, 1]) for (const z of [-1, 1])
          assert.ok(insidePlot(p, plotPoint(p.building, x * p.building.w / 2, z * p.building.d / 2)), "building must fit its parcel");
        if (p.building.style !== "warehouse") {
          assert.ok(p.building.entrance, `${p.building.style} must have an entrance`);
          const e = p.building.entrance!;
          assert.ok(Math.abs(e.x) <= p.building.w / 2 - e.w / 2 - 0.2, "entrance must be within facade width");
          assert.ok(e.z <= -p.building.d / 2 + 0.1 && e.z >= -p.building.d / 2 - 0.1, "entrance must be on the street-facing facade");
          assert.ok(e.w >= 1.4 && e.h >= 2.0, "entrance must be large enough to walk through");
        } else {
          assert.equal(p.building.entrance, undefined, "warehouse stays solid without an entrance");
        }
      }
      for (const other of plan.parcels.slice(i + 1)) {
        if (Math.abs(p.x - other.x) > 70 || Math.abs(p.z - other.z) > 70) continue;
        assert.equal(plotsOverlap(p, other), false, `${p.id} overlaps ${other.id}`);
      }
    }
  }
});

test("cross-boundary parcels have one stable owner and regenerate after seed and visit changes", () => {
  const seed = 87, plan = new WorldPlan(seed);
  const p = plan.parcels.find(p => {
    const c = chunkAt(p.x, p.z), corner = plotPoint(p, p.w / 2, p.d / 2);
    return c.x !== chunkAt(corner.x, corner.z).x || c.z !== chunkAt(corner.x, corner.z).z;
  })!;
  assert.ok(p);
  const c = chunkAt(p.x, p.z), first = generateBlock(seed, c.x, c.z);
  const local = first.parcels.find(candidate => candidate.id === p.id)!;
  assert.equal(local.x + c.x * BLOCK, p.x);
  assert.equal(local.z + c.z * BLOCK, p.z);
  const neighborhood = [];
  for (let x = c.x - 1; x <= c.x + 1; x++) for (let z = c.z - 1; z <= c.z + 1; z++) {
    const block = generateBlock(seed, x, z); neighborhood.push(...block.parcels);
    for (const tree of block.trees) assert.equal(insidePlot(p, { x: tree.x + x * BLOCK, z: tree.z + z * BLOCK }, 2), false, "neighboring tree invades parcel");
  }
  assert.equal(neighborhood.filter(candidate => candidate.id === p.id).length, 1);
  generateBlock(99, c.x, c.z);
  assert.deepEqual(generateBlock(seed, c.x, c.z), first);
});

test("real streetscape colliders leave the house gate and driveway open and align after translation", async () => {
  await R.init();
  const plan = new WorldPlan(87), source = plan.parcels.find(p => p.use === "housing")!;
  const physics = new R.World({ x: 0, y: 0, z: 0 });
  const bodies: R.RigidBody[] = [];
  const p = { ...source, x: 0, z: 0, yaw: 0, y: 0 };
  const rotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), source.yaw);
  buildStreetscape(p, () => {}, (x, y, z, w, h, d) => {
    const point = plotPoint(source, x, z);
    const body = physics.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(point.x, y + source.y, point.z).setRotation(rotation));
    physics.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body); bodies.push(body);
  }, () => {});
  const clearEntrance = (x: number, shift = 0) => {
    const start = plotPoint(source, x, -p.d / 2 - 1), end = plotPoint(source, x, -p.d / 2 + 7);
    const dir = new T.Vector3(end.x - start.x, 0, end.z - start.z).normalize();
    return physics.castRay(new R.Ray({ x: start.x - shift, y: source.y + 0.5, z: start.z }, dir), 8, true) === null;
  };
  physics.step();
  assert.ok(clearEntrance(-2.1), "front pedestrian gate blocked");
  assert.ok(clearEntrance(p.w / 2 - 3.7), "driveway blocked");
  for (const body of bodies) { const pos = body.translation(); body.setTranslation({ ...pos, x: pos.x - 1512 }, false); }
  physics.step();
  assert.ok(clearEntrance(-2.1, 1512));
  assert.ok(clearEntrance(p.w / 2 - 3.7, 1512));
  for (const body of bodies) physics.removeRigidBody(body);
  assert.equal(physics.bodies.len(), 0);
  physics.free();
});
