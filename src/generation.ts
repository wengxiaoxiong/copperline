export const BLOCK = 72;
export const ROAD = 18;
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function randomFor(seed: number, x: number, z: number) {
  let a = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  shop: boolean;
  style: "house" | "shop" | "apartment" | "warehouse";
};
export const DISTRICT_NAMES = {
  residential: "PALM GROVE · 棕榈住宅区", commercial: "MARKET STREET · 商业街",
  apartments: "SUNSET HEIGHTS · 日落公寓", industrial: "HARBOR WORKS · 港湾仓储",
  park: "GARDEN SQUARE · 花园广场",
};
export function districtAt(seed: number, cx: number, cz: number) {
  const districts = Object.keys(DISTRICT_NAMES) as (keyof typeof DISTRICT_NAMES)[];
  return districts[Math.floor(randomFor(seed ^ 9187, Math.floor(cx / 2), Math.floor(cz / 2))() * districts.length)];
}
export function generateBlock(seed: number, cx: number, cz: number) {
  const r = randomFor(seed, cx, cz);
  const buildings: Building[] = [];
  const district = districtAt(seed, cx, cz);
  for (let x = 0; x < 2; x++)
    for (let z = 0; z < 2; z++) {
      const w = 13 + r() * 4,
        d = 13 + r() * 4;
      const style = district === "commercial" ? "shop" : district === "apartments" ? "apartment" : district === "industrial" ? "warehouse" : "house";
      buildings.push({
        style,
        x: 23 + x * 27,
        z: 23 + z * 27,
        w,
        d,
        h: style === "apartment" ? 12 + Math.floor(r() * 4) * 3 : style === "warehouse" ? 7 : 3.8 + Math.floor(r() * 2) * 3,
        color: Math.floor(r() * 6),
        shop: style === "shop" || (style === "house" && r() > 0.85),
      });
    }
  return {
    cx,
    cz,
    district,
    buildings: district === "park" ? [] : district === "industrial"
      ? buildings.filter((_, i) => i < 2).map(b => ({ ...b, x: 36, w: 38, d: 17 }))
      : buildings,
    park: district === "park",
    sign: Math.floor(r() * 6),
    coins: Array.from({ length: 8 }, (_, i) => ({
      id: `${cx},${cz}:${i}`,
      x: i < 4 ? 4 : 18 + (i - 4) * 12,
      z: i < 4 ? 18 + i * 12 : 4,
    })),
  };
}
export function chunkAt(x: number, z: number) {
  return { x: Math.floor(x / BLOCK), z: Math.floor(z / BLOCK) };
}
export function collectedKey(seed: string) {
  return `copperline:${seed}`;
}
export function segmentDistanceSquared(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)),
  );
  return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2;
}
