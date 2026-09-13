import R from "@dimforge/rapier3d-compat";
import * as T from "three";

export type VehicleType = "sedan" | "bicycle" | "motorcycle" | "convertible";
export const VEHICLES = {
  sedan: { name: "HARBOR 轿车", acceleration: 18, maxSpeed: 45, grip: 9, mass: 1000 },
  bicycle: { name: "COAST 自行车", acceleration: 5, maxSpeed: 12, grip: 12, mass: 95 },
  motorcycle: { name: "RAVEN 摩托车", acceleration: 25, maxSpeed: 54, grip: 8, mass: 250 },
  convertible: { name: "SUNSET 敞篷车", acceleration: 21, maxSpeed: 49, grip: 7, mass: 1150 },
};

/** Planar tire response; ground support and Rapier handle vertical motion. */
export function driveVehicle(type: VehicleType, velocity: { x: number; z: number }, yaw: number, throttle: number, steer: number, brake: boolean, dt: number) {
  const spec = VEHICLES[type];
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  let speed = velocity.x * forward.x + velocity.z * forward.z;
  const acceleration = throttle * (throttle * speed < 0 ? 30 : spec.acceleration);
  const drag = brake ? (type === "bicycle" ? 3 : 1.1) : throttle === 0 ? .22 : .08;
  speed = Math.max(-6, Math.min(spec.maxSpeed, (speed + acceleration * dt) * Math.exp(-drag * dt)));
  const turn = steer * Math.max(-1, Math.min(1, speed / 7)) * (brake ? 1.5 : 1) / (1 + Math.abs(speed) / 65);
  const nextYaw = yaw + turn * dt;
  // Keep world momentum through the turn, then let tire grip pull it toward the new heading.
  const vx = velocity.x + forward.x * (speed - (velocity.x * forward.x + velocity.z * forward.z));
  const vz = velocity.z + forward.z * (speed - (velocity.x * forward.x + velocity.z * forward.z));
  const fx = -Math.sin(nextYaw), fz = -Math.cos(nextYaw), rx = Math.cos(nextYaw), rz = -Math.sin(nextYaw);
  const longitudinal = vx * fx + vz * fz;
  const lateral = (vx * rx + vz * rz) * Math.exp(-(brake ? 1.1 : spec.grip) * dt);
  return { yaw: nextYaw, speed: longitudinal, lateral, x: fx * longitudinal + rx * lateral, z: fz * longitudinal + rz * lateral };
}

/** Smooth chassis attitude on physical support; return the supported vertical velocity. */
export function alignVehicle(body: R.RigidBody, physics: R.World, yaw: number, dt: number, velocity: { x: number; y: number; z: number }) {
  const pos = body.translation();
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const height = (x: number, z: number) => {
    const hit = physics.castRayAndGetNormal(new R.Ray({ x, y: pos.y + 1, z }, { x: 0, y: -1, z: 0 }), 2, true, R.QueryFilterFlags.ONLY_FIXED);
    return hit && hit.normal.y > .65 ? pos.y + 1 - hit.timeOfImpact : undefined;
  };
  const front = height(pos.x + fx * 1.2, pos.z + fz * 1.2), rear = height(pos.x - fx * 1.2, pos.z - fz * 1.2);
  const right = height(pos.x + rx * .35, pos.z + rz * .35), left = height(pos.x - rx * .35, pos.z - rz * .35);
  const ground = height(pos.x, pos.z), nextGround = height(pos.x + velocity.x * dt, pos.z + velocity.z * dt);
  if (front === undefined || rear === undefined || right === undefined || left === undefined || ground === undefined || nextGround === undefined) return velocity.y;
  if (pos.y - ground > .35 || ground - pos.y > .15 || Math.abs(nextGround - ground) > .2) return velocity.y;
  const pitch = Math.atan2(front - rear, 2.4), roll = Math.atan2(right - left, .7);
  const rotation = new T.Quaternion().copy(body.rotation());
  rotation.slerp(new T.Quaternion().setFromEuler(new T.Euler(pitch, yaw, roll, "YXZ")), 1 - Math.exp(-12 * dt));
  body.setRotation(rotation, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  // While in contact, follow the support tangent and settle small contact gaps.
  // Beyond this short reach the body keeps its ballistic vertical velocity.
  return T.MathUtils.clamp((nextGround - ground) / dt + (ground + .025 - pos.y) * 12, -8, 8);
}
