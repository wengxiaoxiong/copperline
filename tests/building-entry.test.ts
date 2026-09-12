import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { City } from "../src/world.ts";
import { Game } from "../src/game.ts";
import { BLOCK, chunkAt, hashSeed, worldPlan, type Building } from "../src/generation.ts";
import { plotPoint } from "../src/parcels.ts";

// Substitute only canvas drawing. City, meshes, terrain and Rapier stay real.
const context = new Proxy({}, { get: () => () => {} });
const documentStub = { createElement: () => ({ getContext: () => context }) };

function point(b: Building, x: number, z: number, y: number) {
  const p = plotPoint(b, x, z);
  return new T.Vector3(p.x, b.y + y, p.z);
}

test("real City entrances are visibly open and support walking in and out", async () => {
  await R.init();
  const previous = globalThis.document;
  globalThis.document = documentStub as unknown as Document;
  const physics = new R.World({ x: 0, y: -18, z: 0 });
  const scene = new T.Scene(), seed = hashSeed("PALM-GROVE-2026");
  const city = new City(scene, physics, seed);
  try {
    for (const style of ["house", "shop", "apartment"] as const) {
      const buildings = worldPlan(seed).parcels.flatMap(p => p.building?.style === style ? [p.building] : []);
      buildings.sort((a, b) => a.entrance!.x - b.entrance!.x);
      for (const b of [buildings[0], buildings[Math.floor(buildings.length / 2)], buildings.at(-1)!]) {
        const c = chunkAt(b.x, b.z);
        city.create(c.x, c.z);
        physics.step(); scene.updateMatrixWorld(true);
        const e = b.entrance!;
        const from = point(b, e.x, e.z - 1, 1.4), to = point(b, e.x, e.z + 0.8, 1.4);
        const direction = to.clone().sub(from).normalize();
        for (const dx of [-e.w / 2 + 0.1, 0, e.w / 2 - 0.1]) {
          const ray = new T.Raycaster(point(b, e.x + dx, e.z - 1, 1.4), direction, 0, from.distanceTo(to));
          assert.equal(ray.intersectObjects(city.occluders, true).length, 0, `${style}: visible geometry covers the doorway`);
        }
        assert.equal(!!physics.castRay(new R.Ray(from, direction), from.distanceTo(to), true), false, `${style}: collider covers doorway`);
        // Use the same capsule and controller settings as Game, including gravity and steps.
        const start = point(b, e.x, e.z - 2, 0.97);
        const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z));
        const collider = physics.createCollider(R.ColliderDesc.capsule(0.52, 0.32), body);
        const controller = physics.createCharacterController(0.03);
        controller.enableAutostep(0.35, 0.2, false); controller.enableSnapToGround(0.3); controller.setSlideEnabled(true);
        const walk = (sign: number, frames = 72) => {
          for (let i = 0; i < frames; i++) {
            controller.computeColliderMovement(collider, { x: direction.x * sign / 15, y: -0.05, z: direction.z * sign / 15 });
            const p = body.translation(), m = controller.computedMovement();
            body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }); physics.step();
          }
        };
        physics.step(); walk(1);
        assert.ok(new T.Vector3().copy(body.translation()).sub(start).dot(direction) > 3.5, `${style}: player cannot walk inside`);
        if (style === "house") {
          const bedroom = point(b, 0, b.d / 2 - 0.35 - 3.6 + 0.6, 0.97);
          const extra = Math.round(bedroom.clone().sub(new T.Vector3().copy(body.translation())).dot(direction) * 15);
          walk(1, extra);
          assert.ok(new T.Vector3().copy(body.translation()).distanceTo(bedroom) < 0.35, "house: bedroom doorway is blocked");
          walk(-1, extra);
        }
        walk(-1);
        assert.ok(new T.Vector3().copy(body.translation()).distanceTo(start) < 0.4, `${style}: player cannot return outside`);
        physics.removeCharacterController(controller); physics.removeRigidBody(body);
        city.remove(city.chunks.get(`${c.x},${c.z}`)!);
      }
    }
  } finally {
    city.reset(seed); physics.free(); globalThis.document = previous;
  }
});

test("entrance hint follows rotated buildings, negative chunks and origin shifts", () => {
  const g = Object.create(Game.prototype) as Game;
  const b: Building = { x: 25, z: 40, y: 3, w: 18, d: 15, h: 6, yaw: 1.2, style: "house", color: 0, shop: false, entrance: { x: 2, z: -7.5, w: 2, h: 2.4 } };
  const offset = new T.Vector3(1512, 0, -1512), p = plotPoint(b, b.entrance!.x, b.entrance!.z);
  const position = new T.Vector3(-BLOCK + p.x, b.y + 0.95, -2 * BLOCK + p.z).sub(offset);
  g.city = { offset, chunks: new Map([["-1,-2", { cx: -1, cz: -2, layout: { buildings: [b] } }]]) } as unknown as City;
  g.activePosition = () => position.clone();
  assert.equal(g.nearBuildingEntrance(), true);
  position.x += 6;
  assert.equal(g.nearBuildingEntrance(), false);
});
