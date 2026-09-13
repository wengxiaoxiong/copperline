export type VehicleType = "sedan" | "bicycle" | "motorcycle" | "convertible";
export const VEHICLES = {
  sedan: { name: "HARBOR 轿车", acceleration: 18, maxSpeed: 45, grip: 9, mass: 1000 },
  bicycle: { name: "COAST 自行车", acceleration: 5, maxSpeed: 12, grip: 12, mass: 95 },
  motorcycle: { name: "RAVEN 摩托车", acceleration: 25, maxSpeed: 54, grip: 8, mass: 250 },
  convertible: { name: "SUNSET 敞篷车", acceleration: 21, maxSpeed: 49, grip: 7, mass: 1150 },
};

/** Planar tire response; Rapier retains vertical velocity and collision response. */
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
