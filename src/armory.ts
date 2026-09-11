import * as T from 'three';
import { SHOP } from './inventory';
export function createShop() {
  const group = new T.Group(); group.name = '复活点武器商店';
  const metal = new T.MeshStandardMaterial({ color: 0x253d35 });
  const gold = new T.MeshStandardMaterial({ color: 0xf3c566, emissive: 0x493008 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material = metal) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); group.add(mesh);
  };
  box(2.8, 1, 1, 0, .5, 0); box(3.3, .18, 1.8, 0, 2.7, 0, gold);
  for (const x of [-1.3, 1.3]) box(.1, 2.7, .1, x, 1.35, .35);
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#203b31'; ctx.fillRect(0, 0, 768, 160);
  ctx.fillStyle = '#ffd887'; ctx.textAlign = 'center'; ctx.font = 'bold 54px sans-serif'; ctx.fillText('武器商店 · ARMORY', 384, 66);
  ctx.font = '32px sans-serif'; ctx.fillText('3 / 5 / 8 金币 · 按 E 购买', 384, 123);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const sign = new T.Mesh(new T.PlaneGeometry(3.3, .7), new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
  sign.position.set(0, 2.15, -.55); sign.rotation.y = Math.PI; group.add(sign);
  const ring = new T.Mesh(new T.RingGeometry(1.6, 1.85, 48), new T.MeshBasicMaterial({ color: 0xffd076, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, .06, -2); group.add(ring);
  group.position.set(SHOP.x, 0, SHOP.z); return group;
}
export function createExtraWeapons(parent: T.Group) {
  return [1, 2, 3].map(slot => {
    const group = new T.Group(); parent.add(group); group.visible = false;
    const steel = new T.MeshStandardMaterial({ color: slot === 2 ? 0x35454b : 0x333638, metalness: .7, roughness: .4 });
    const grip = new T.MeshStandardMaterial({ color: slot === 3 ? 0x805535 : 0x222526 });
    const box = (w: number, h: number, d: number, y: number, z: number, material = steel) => {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material); mesh.position.set(0, y, z); group.add(mesh);
    };
    const length = slot === 1 ? .28 : slot === 2 ? .46 : .9;
    box(.075, .09, length, 0, -length / 2);
    box(.07, .19, .085, -.1, -.04, grip);
    if (slot === 2) { box(.06, .22, .07, -.12, -.22); box(.065, .1, .18, 0, .08, grip); }
    if (slot === 3) { box(.085, .09, .24, -.055, -.43, grip); box(.08, .12, .23, -.025, .08, grip); }
    const muzzle = new T.Object3D(); muzzle.position.z = -length; group.add(muzzle);
    const flash = new T.Mesh(new T.SphereGeometry(.055, 6, 4), new T.MeshBasicMaterial({color: 0xffdd88}));
    flash.scale.z = 2.5; flash.visible = false; muzzle.add(flash);
    return { group, muzzle, flash, flashTime: 0 };
  });
}
