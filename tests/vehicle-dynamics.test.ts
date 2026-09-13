import { test } from "node:test";
import assert from "node:assert/strict";
import { driveVehicle } from "../src/vehicle-dynamics.ts";
test("coasting keeps momentum; braking dissipates it and preserves more lateral slip", () => {
  const velocity = { x: 4, z: -20 };
  const coast = driveVehicle("sedan", velocity, 0, 0, 0, false, .1);
  const brake = driveVehicle("sedan", velocity, 0, 0, 0, true, .1);
  assert.ok(coast.speed > 19 && coast.speed < 20);
  assert.ok(brake.speed < coast.speed);
  assert.ok(Math.abs(brake.lateral) > Math.abs(coast.lateral));
});
test("steering keeps world momentum and vehicle acceleration differs", () => {
  const turn = driveVehicle("sedan", { x: 0, z: -20 }, 0, 0, 1, false, .05);
  assert.ok(turn.yaw > 0);
  assert.ok(Math.abs(turn.lateral) > 0);
  const bike = driveVehicle("bicycle", { x: 0, z: 0 }, 0, 1, 0, false, .1);
  const motor = driveVehicle("motorcycle", { x: 0, z: 0 }, 0, 1, 0, false, .1);
  assert.ok(motor.speed > bike.speed * 3);
});
