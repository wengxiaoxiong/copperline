import * as T from "three";

export type ShotQuery = {
  camera: T.Camera;
  muzzle: T.Object3D;
  candidates: T.Object3D[];
  range: number;
  spread: number;
};

/** Caller updates scene matrices before tracing. Damage and effects belong to the caller. */
export function traceShot(query: ShotQuery, random: () => number = Math.random) {
  const { camera, candidates, range, spread } = query;
  const direction = camera.getWorldDirection(new T.Vector3());
  direction.x += (random() - 0.5) * spread;
  direction.y += (random() - 0.5) * spread;
  direction.normalize();
  // Ray retains the origin reference; never give it the live camera position.
  const ray = new T.Raycaster(camera.position.clone(), direction, 0, range);
  const aimHit = ray.intersectObjects(candidates, true)[0];
  const aim = aimHit?.point ?? camera.position.clone().addScaledVector(direction, range);
  const muzzle = query.muzzle.getWorldPosition(new T.Vector3());
  const bullet = aim.clone().sub(muzzle);
  ray.set(muzzle, bullet.clone().normalize());
  ray.far = Math.min(range, bullet.length() + 0.05);
  const hit = ray.intersectObjects(candidates, true)[0];
  const impact = hit?.point ?? muzzle.clone().addScaledVector(bullet.clone().normalize(), Math.min(range, bullet.length()));
  return { hit, muzzle, impact };
}
