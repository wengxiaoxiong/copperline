import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTouchControls, normalizeJoystick } from "../src/mobile-controls.ts";

test("joystick applies a dead zone and preserves analog direction", () => {
  assert.deepEqual(normalizeJoystick(3, 4, 100), { x: 0, y: 0, magnitude: 0 });
  const vector = normalizeJoystick(30, -40, 50);
  assert.equal(vector.magnitude, 1);
  assert.ok(Math.abs(vector.x - 0.6) < 0.0001);
  assert.ok(Math.abs(vector.y + 0.8) < 0.0001);
});

test("joystick clamps touches outside its base and rejects invalid geometry", () => {
  const vector = normalizeJoystick(0, 200, 50);
  assert.deepEqual(vector, { x: 0, y: 1, magnitude: 1 });
  assert.deepEqual(normalizeJoystick(10, 10, 0), { x: 0, y: 0, magnitude: 0 });
});

test("touch controls require both touch points and a coarse primary pointer", () => {
  const coarse = { matchMedia: () => ({ matches: true }) } as unknown as Pick<Window, "matchMedia">;
  const fine = { matchMedia: () => ({ matches: false }) } as unknown as Pick<Window, "matchMedia">;
  assert.equal(hasTouchControls(coarse, { maxTouchPoints: 5 }), true);
  assert.equal(hasTouchControls(fine, { maxTouchPoints: 5 }), false);
  assert.equal(hasTouchControls(coarse, { maxTouchPoints: 0 }), false);
});
