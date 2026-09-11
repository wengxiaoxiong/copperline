import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import R from "@dimforge/rapier3d-compat";
import { Game } from "../src/game.ts";
import { CameraRig } from "../src/camera-rig.ts";
import { Inventory } from "../src/inventory.ts";
test("actual shooting and camera updates keep the settled camera stationary", async () => {
  await R.init();
  const g = Object.create(Game.prototype) as Game;
  g.physics = new R.World({ x: 0, y: -18, z: 0 });
  const ground = g.physics.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
  );
  g.physics.createCollider(R.ColliderDesc.cuboid(256, 0.5, 256), ground);
  g.playerBody = g.physics.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(5, 0.87, 18),
  );
  g.physics.step();
  g.person = { root: new T.Group() } as Game["person"];
  g.person.root.position.set(5, 0, 18);
  g.car = { root: new T.Group() } as Game["car"];
  g.camera = new T.PerspectiveCamera(62, 1.5, 0.08, 210);
  g.camera.position.set(5, 3, 25);
  g.cameraRig = new CameraRig();
  g.driving = false;
  g.aiming = false;
  g.pitch = -0.08;
  g.yaw = -0.42;
  g.keys = new Set();
  g.inventory = new Inventory();
  g.scene = new T.Scene();
  g.scene.add(g.person.root);
  const muzzle = new T.Object3D();
  muzzle.position.set(5, 1.4, 17);
  g.scene.add(muzzle);
  g.weapon = { muzzle, flash() {} } as Game["weapon"];
  g.sound = { shot() {} } as Game["sound"];
  g.effects = [];
  g.city = { occluders: [], targets: [] } as unknown as Game["city"];
  for (let i = 0; i < 180; i++) g.updateCamera(1 / 60);
  const baseline = g.camera.position.clone();
  for (let i = 0; i < 1200; i++) {
    g.weaponState.update(1 / 60);
    if (i % 7 === 0) {
      g.weaponState.ammo = 30;
      const before = g.camera.position.clone();
      g.fire();
      assert.ok(
        g.camera.position.equals(before),
        "fire must not mutate camera position",
      );
    }
    g.updateCamera(1 / 60);
    assert.ok(
      g.camera.position.distanceTo(baseline) < 0.001,
      `camera moved ${g.camera.position.distanceTo(baseline)}`,
    );
  }
  assert.equal(g.pitch, -0.08);
  assert.equal(g.yaw, -0.42);
  assert.ok(g.weaponState.shots > 100);
  g.physics.free();
});
