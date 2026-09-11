import { MathUtils, Vector3 } from "three";
// Recoil changes the viewing direction only; it never moves the camera boom.
export class CameraRig {
  aimBlend = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  kick(random = Math.random()) {
    this.recoilPitch = Math.min(0.035, this.recoilPitch + 0.009);
    this.recoilYaw = MathUtils.clamp(
      this.recoilYaw + (random - 0.5) * 0.003,
      -0.008,
      0.008,
    );
  }
  reset() {
    this.aimBlend = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
  }
  update(
    dt: number,
    anchor: Vector3,
    yaw: number,
    pitch: number,
    aiming: boolean,
    driving: boolean,
    firstPerson = false,
  ) {
    this.aimBlend = MathUtils.damp(
      this.aimBlend,
      aiming && !driving ? 1 : 0,
      7,
      dt,
    );
    this.recoilPitch *= Math.exp(-dt * 12);
    this.recoilYaw *= Math.exp(-dt * 12);
    const distance = driving ? 8.5 : MathUtils.lerp(4.2, 3.8, this.aimBlend);
    // Looking upward must not swing the boom down through the ground.
    const boomPitch = Math.min(pitch, 0.12);
    const boom = new Vector3(
      -Math.sin(yaw) * Math.cos(boomPitch),
      Math.sin(boomPitch),
      -Math.cos(yaw) * Math.cos(boomPitch),
    );
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const shoulder = driving ? 0 : MathUtils.lerp(0.6, 0.7, this.aimBlend);
    const position = anchor
      .clone()
      .addScaledVector(boom, -distance)
      .addScaledVector(right, shoulder);
    position.y += driving ? 1.3 : MathUtils.lerp(0.65, 0.5, this.aimBlend);
    const viewYaw = yaw + this.recoilYaw,
      viewPitch = pitch + this.recoilPitch;
    const look = new Vector3(
      -Math.sin(viewYaw) * Math.cos(viewPitch),
      Math.sin(viewPitch),
      -Math.cos(viewYaw) * Math.cos(viewPitch),
    );
    if (firstPerson) {
      const position = anchor.clone().addScaledVector(look, 0.08);
      return {
        position,
        target: position.clone().addScaledVector(look, 60),
        look,
        fov: driving ? 72 : MathUtils.lerp(70, 62, this.aimBlend),
      };
    }
    return {
      position,
      target: position.clone().addScaledVector(look, 60),
      look,
      fov: driving ? 68 : MathUtils.lerp(62, 56, this.aimBlend),
    };
  }
}
