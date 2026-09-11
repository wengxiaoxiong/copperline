import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { CameraRig } from "../src/camera-rig.ts";
test("sustained recoil never changes boom position or accumulates aim drift", () => {
  const rig = new CameraRig(),
    anchor = new Vector3(0, 1.52, 0);
  const baseline = rig.update(1 / 60, anchor, 0, 0, false, false).position;
  for (let i = 0; i < 1800; i++) {
    if (i % 6 === 0) rig.kick(0.6);
    const pose = rig.update(1 / 60, anchor, 0, 0, false, false);
    assert.ok(pose.position.distanceTo(baseline) < 1e-12);
    assert.ok(rig.recoilPitch < 0.035);
  }
  for (let i = 0; i < 120; i++) rig.update(1 / 60, anchor, 0, 0, false, false);
  assert.ok(rig.recoilPitch < 1e-9);
});
test("full upward aim keeps boom above ground without collapsing distance", () => {
  const rig = new CameraRig(),
    anchor = new Vector3(0, 1.52, 0);
  for (const aiming of [false, true])
    for (let i = 0; i < 120; i++) {
      const p = rig.update(1 / 60, anchor, 0, 0.55, aiming, false);
      assert.ok(p.position.y > 1.4);
      assert.ok(p.position.distanceTo(anchor) >= 3.8);
    }
});
test("aim transition is gradual and independent of frame rate", () => {
  const anchor = new Vector3(0, 1.52, 0),
    a = new CameraRig(),
    b = new CameraRig();
  const before = a.update(0, anchor, 0, 0, false, false);
  const first = a.update(1 / 60, anchor, 0, 0, true, false);
  assert.ok(first.position.distanceTo(before.position) < 0.18);
  assert.ok(before.fov - first.fov < 0.7);
  for (let i = 1; i < 60; i++) a.update(1 / 60, anchor, 0, 0, true, false);
  for (let i = 0; i < 120; i++) b.update(1 / 120, anchor, 0, 0, true, false);
  assert.ok(Math.abs(a.aimBlend - b.aimBlend) < 1e-10);
});
