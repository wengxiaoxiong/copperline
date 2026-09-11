// MR-17 timing and recoil adapted from BLACKWATER, MIT.
// Third-person targeting and independent weapon state by Copperline.
export class WeaponState {
  ammo: number;
  constructor(public spec = { capacity: 30, interval: 0.105, reload: 2.05 }) { this.ammo = spec.capacity; }
  cooldown = 0;
  reloadTime = 0;
  recoil = 0;
  shots = 0;
  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.reloadTime > 0) {
      this.reloadTime = Math.max(0, this.reloadTime - dt);
      if (this.reloadTime === 0) this.ammo = this.spec.capacity;
    }
  }
  reload() {
    if (this.ammo === this.spec.capacity || this.reloadTime > 0) return false;
    this.reloadTime = this.spec.reload;
    return true;
  }
  fire(sprinting = false) {
    if (this.cooldown > 0 || this.reloadTime > 0 || sprinting) return false;
    if (this.ammo <= 0) {
      this.reload();
      return false;
    }
    this.cooldown = this.spec.interval;
    this.ammo--;
    this.recoil = 1;
    this.shots++;
    return true;
  }
  reset() {
    this.ammo = this.spec.capacity;
    this.cooldown = 0;
    this.reloadTime = 0;
    this.recoil = 0;
    this.shots = 0;
  }
}
