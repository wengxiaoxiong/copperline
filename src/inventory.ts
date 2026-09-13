import { WeaponState } from './combat';
export const WEAPONS = [
  { id: 'rifle', name: 'MR-17 步枪', price: 0, capacity: 30, interval: .105, reload: 2.05, damage: 39, range: 120, spread: .006, pellets: 1, description: '均衡精准 · 初始装备' },
  { id: 'pistol', name: 'P9 手枪', price: 3, capacity: 12, interval: .32, reload: 1.2, damage: 30, range: 75, spread: .008, pellets: 1, description: '轻巧可靠 · 快速换弹' },
  { id: 'smg', name: 'SMG 冲锋枪', price: 5, capacity: 40, interval: .065, reload: 1.7, damage: 22, range: 65, spread: .018, pellets: 1, description: '高速连射 · 近距离压制' },
  { id: 'shotgun', name: 'SG-8 霰弹枪', price: 8, capacity: 8, interval: .85, reload: 2.5, damage: 18, range: 32, spread: .12, pellets: 7, description: '七发散射 · 近身威力强' },
  { id: 'sniper', name: 'SR-5 狙击枪', price: 12, capacity: 5, interval: 1.25, reload: 2.8, damage: 120, range: 280, spread: .001, pellets: 1, description: '远距精准 · 右键 / 开镜按钮 4×瞄准' },
  { id: 'lmg', name: 'LM-60 轻机枪', price: 15, capacity: 60, interval: .09, reload: 3.8, damage: 32, range: 110, spread: .014, pellets: 1, description: '大弹匣持续火力 · 换弹较慢' },
] as const;
export type WeaponSpec = typeof WEAPONS[number];
export const SHOP = { x: 8, z: 25 };
export class Inventory {
  selected = 0;
  owned = new Map<number, WeaponState>([[0, new WeaponState(WEAPONS[0])]]);
  get current() { return this.owned.get(this.selected)!; }
  get spec() { return WEAPONS[this.selected]; }
  equip(slot: number) { if (!this.owned.has(slot)) return false; this.selected = slot; return true; }
  buy(slot: number, coins: number) {
    const spec = WEAPONS[slot];
    if (!spec || this.owned.has(slot) || coins < spec.price) return { bought: false, coins };
    this.owned.set(slot, new WeaponState(spec)); this.selected = slot;
    return { bought: true, coins: coins - spec.price };
  }
}
