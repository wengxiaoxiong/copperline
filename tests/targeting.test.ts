import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { traceShot } from "../src/targeting.ts";

test("muzzle obstruction wins even when the camera can see the target", () => {
  const camera = new T.PerspectiveCamera();
  camera.position.set(0, 2, 0);
  const muzzle = new T.Object3D();
  muzzle.position.set(2, 0, 0);
  const target = new T.Mesh(new T.BoxGeometry(2, 2, 1), new T.MeshBasicMaterial());
  target.position.set(0, 2, -10);
  const wall = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshBasicMaterial());
  wall.position.set(1.5, 0.5, -2);
  for (const o of [camera, muzzle, target, wall]) o.updateMatrixWorld(true);
  const before = camera.position.clone();
  const origin = muzzle.position.clone();
  const shot = traceShot({ camera, muzzle, candidates: [target, wall], range: 30, spread: 0 });
  assert.equal(shot.hit?.object, wall);
  assert.equal(shot.impact.z, -1.5);
  assert.deepEqual(camera.position, before);
  assert.deepEqual(muzzle.position, origin);
  for (const mesh of [target, wall]) { mesh.geometry.dispose(); mesh.material.dispose(); }
});

test("a miss stops at weapon range and injected spread remains reproducible", () => {
  const camera = new T.PerspectiveCamera();
  const muzzle = new T.Object3D();
  camera.updateMatrixWorld(true); muzzle.updateMatrixWorld(true);
  const query = { camera, muzzle, candidates: [], range: 12, spread: 0.1 };
  const shot = traceShot(query, () => 0.5);
  assert.equal(shot.hit, undefined);
  assert.deepEqual(shot.impact.toArray(), [0, 0, -12]);
  const scattered = traceShot(query, () => 1);
  assert.deepEqual(scattered.impact, traceShot(query, () => 1).impact);
  assert.ok(Math.abs(scattered.impact.distanceTo(scattered.muzzle) - 12) < 1e-10);
});
