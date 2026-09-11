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
export type Point = { x: number; z: number };
export type RoadNode = Point & { id: number };
export type RoadEdge = { id: number; a: number; b: number; points: Point[]; width: number; length: number; bridge: boolean };
export type Building = Point & { w: number; d: number; h: number; y: number; yaw: number; color: number; shop: boolean; style: "house" | "shop" | "apartment" | "warehouse" };
export const DISTRICT_NAMES = {
  residential: "PALM GROVE · 棕榈住宅区", commercial: "MARKET STREET · 商业街",
  apartments: "SUNSET HEIGHTS · 日落中心", industrial: "HARBOR WORKS · 港湾仓储",
  park: "RIVERSIDE · 河畔公园", oldtown: "OLD COPPER · 铜线老城",
  hills: "SIERRA VISTA · 山地观景区", coast: "OCEAN DRIVE · 海滨大道",
};
export type District = keyof typeof DISTRICT_NAMES;
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export class WorldPlan {
  nodes: RoadNode[] = [];
  roads: RoadEdge[] = [];
  landmarks: (Point & { name: string; kind: "tower" | "lighthouse" | "crane" | "plaza" })[] = [];
  segments: { a: Point; b: Point; road: RoadEdge; start: number; length: number }[] = [];
  adjacency = new Map<number, RoadEdge[]>();
  phase: number;
  constructor(public seed: number) {
    this.phase = (seed % 997) / 997 * 6.28;
    const r = randomFor(seed ^ 989, 0, 0);
    const xs = [-720, -530, -350, -165, 0, 155, 320, 510, 725];
    const zs = [-620, -440, -275, -125, 0, 180, 345];
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
      let x = xs[i] + (r() - 0.5) * 42, z = zs[j] + (r() - 0.5) * 44;
      if (i === 4) x = Math.sin(j * 0.9) * 25;
      if (j === 4) z = Math.sin(i * 0.85) * 24;
      if (j === 4 && i === 4) { x = 0; z = 0; }
      this.nodes.push({ id: this.nodes.length, x, z });
    }
    const link = (a: number, b: number, width: number) => {
      const from = this.nodes[a], to = this.nodes[b];
      const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
      const bend = (r() - 0.5) * (from.z < -250 ? 40 : 14);
      const points = Array.from({ length: 9 }, (_, k) => {
        const t = k / 8, bulge = Math.sin(t * Math.PI) ** 2 * bend;
        return { x: from.x + dx * t - dz / len * bulge, z: from.z + dz * t + dx / len * bulge };
      });
      const road: RoadEdge = { id: this.roads.length, a, b, points, width, length: 0, bridge: points.some(p => this.isWater(p.x, p.z)) };
      for (let k = 1; k < points.length; k++) {
        const length = distance(points[k - 1], points[k]);
        this.segments.push({ a: points[k - 1], b: points[k], road, start: road.length, length });
        road.length += length;
      }
      this.roads.push(road);
      for (const n of [a, b]) { if (!this.adjacency.has(n)) this.adjacency.set(n, []); this.adjacency.get(n)!.push(road); }
    };
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
      const n = j * xs.length + i;
      // A connected arterial spine survives all seed variations; side streets can end.
      if (i < xs.length - 1 && (j === 4 || j === 6 || (j < 2 ? i % 3 === j : r() > 0.24))) link(n, n + 1, j === 4 ? 18 : j < 2 ? 10 : 12);
      if (j < zs.length - 1) link(n, n + xs.length, i === 4 ? 18 : i < 3 ? 10 : 12);
    }
    // Diagonal lanes in the old quarter and hillside connectors break up the arterial grid.
    for (const [a, b] of [[0, 10], [11, 21], [45, 55], [46, 56]]) link(a, b, 9);
    // The ocean road follows the coastline instead of the streaming grid.
    let previous = -1;
    for (let i = 0; i < xs.length; i++) {
      const id = this.nodes.length;
      this.nodes.push({ id, x: xs[i], z: this.coastAt(xs[i]) - 38 });
      link((zs.length - 1) * xs.length + i, id, 12);
      if (previous >= 0) link(previous, id, 16);
      previous = id;
    }
    this.landmarks = [
      { x: -540, z: -500, kind: "tower", name: "山顶水塔" },
      { x: -50, z: -90, kind: "plaza", name: "日落广场" },
      { x: 470, z: 280, kind: "crane", name: "铜线港" },
      { x: -350, z: this.coastAt(-350) - 10, kind: "lighthouse", name: "海角灯塔" },
    ];
    for (const landmark of this.landmarks) {
      const origin = { x: landmark.x, z: landmark.z };
      const clearance = landmark.kind === "crane" ? 42 : landmark.kind === "plaza" ? 18 : 10;
      let placed = false;
      for (let radius = 0; radius <= 160 && !placed; radius += 12) for (let angle = 0; angle < 16; angle++) {
        const x = origin.x + Math.cos(angle * Math.PI / 8) * radius, z = origin.z + Math.sin(angle * Math.PI / 8) * radius;
        const nearest = this.nearestRoad(x, z);
        if (nearest.distance < nearest.road.width / 2 + clearance + 3 || this.isWater(x, z)) continue;
        if (z + clearance > this.coastAt(x) || Math.abs(x - this.riverAt(z)) < clearance + 22) continue;
        landmark.x = x; landmark.z = z; placed = true; break;
      }
    }
  }
  coastAt(x: number) { return 525 + Math.sin(x / 230 + this.phase) * 36 + Math.sin(x / 490) * 25; }
  riverAt(z: number) { return 235 + Math.sin(z / 180 + this.phase) * 36; }
  isWater(x: number, z: number) { return z > this.coastAt(x) || Math.abs(x - this.riverAt(z)) < 19; }
  naturalHeight(x: number, z: number) {
    const ocean = this.coastAt(x) - z;
    const river = Math.abs(x - this.riverAt(z));
    const hill = smooth(-210, -580, z) * smooth(100, -440, x);
    const land = 1.1 + hill * (24 + 10 * Math.sin(x / 160 + this.phase) * Math.cos(z / 210));
    return land * smooth(-16, 25, ocean) * smooth(10, 36, river) - 4 * (1 - smooth(-16, 0, ocean)) - 3 * (1 - smooth(10, 19, river));
  }
  roadHeight(road: RoadEdge, t: number) {
    const a = this.nodes[road.a], b = this.nodes[road.b];
    return Math.max(1.15, this.naturalHeight(a.x, a.z)) * (1 - t) + Math.max(1.15, this.naturalHeight(b.x, b.z)) * t + (road.bridge ? 2.8 * Math.sin(t * Math.PI) ** 2 : 0);
  }
  nearestRoad(x: number, z: number) {
    let best = Infinity;
    let found = this.segments[0], along = 0, px = 0, pz = 0;
    for (const s of this.segments) {
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z;
      const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (s.length * s.length)));
      const qx = s.a.x + dx * t, qz = s.a.z + dz * t, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; found = s; along = s.start + s.length * t; px = qx; pz = qz; }
    }
    return { x: px, z: pz, distance: Math.sqrt(best), road: found.road, along, yaw: Math.atan2(-(found.b.x - found.a.x), -(found.b.z - found.a.z)) };
  }
  heightAt(x: number, z: number) {
    const n = this.nearestRoad(x, z);
    const base = this.naturalHeight(x, z);
    // Water remains below bridge decks; the bridge owns its separate collider.
    if (this.isWater(x, z)) return base;
    const blend = 1 - smooth(n.road.width / 2 + 2, n.road.width / 2 + 12, n.distance);
    return base * (1 - blend) + this.roadHeight(n.road, n.along / n.road.length) * blend;
  }
  surfaceAt(x: number, z: number) {
    const n = this.nearestRoad(x, z);
    return n.distance <= n.road.width / 2 + 2 ? this.roadHeight(n.road, n.along / n.road.length) + 0.12 : this.heightAt(x, z);
  }
  district(x: number, z: number): District {
    if (z > this.coastAt(x) - 85) return "coast";
    if (x < -230 && z < -240) return "hills";
    if (Math.abs(x - this.riverAt(z)) < 65) return "park";
    if (x > 330 && z > 70) return "industrial";
    if (x < -290 && z > 30) return "oldtown";
    if (Math.hypot(x + 25, z + 135) < 130) return "apartments";
    if (Math.abs(z) < 80 && Math.abs(x) > 100) return "commercial";
    return "residential";
  }
  sampleRoad(road: RoadEdge, along: number, lane = 0) {
    const d = Math.max(0, Math.min(road.length - 0.00001, along));
    const s = this.segments.find(s => s.road === road && d <= s.start + s.length)!;
    const t = (d - s.start) / s.length, dx = (s.b.x - s.a.x) / s.length, dz = (s.b.z - s.a.z) / s.length;
    return { x: s.a.x + dx * (d - s.start) - dz * lane, z: s.a.z + dz * (d - s.start) + dx * lane, y: this.roadHeight(road, d / road.length) + 0.13, yaw: Math.atan2(-dx, -dz), t };
  }
  route(from: Point, to: Point): Point[] {
    const start = this.nearestRoad(from.x, from.z), end = this.nearestRoad(to.x, to.z);
    const costs = new Map<number, number>([[start.road.a, start.along], [start.road.b, start.road.length - start.along]]);
    const prev = new Map<number, { node: number; road: RoadEdge }>();
    const open = new Set(costs.keys());
    while (open.size) {
      const current = [...open].sort((a, b) => costs.get(a)! - costs.get(b)!)[0]; open.delete(current);
      for (const edge of this.adjacency.get(current) ?? []) {
        const next = edge.a === current ? edge.b : edge.a, cost = costs.get(current)! + edge.length;
        if (cost < (costs.get(next) ?? Infinity)) { costs.set(next, cost); prev.set(next, { node: current, road: edge }); open.add(next); }
      }
    }
    const viaA = (costs.get(end.road.a) ?? Infinity) + end.along;
    const viaB = (costs.get(end.road.b) ?? Infinity) + end.road.length - end.along;
    const path: Point[] = [];
    const appendRange = (road: RoadEdge, a: number, b: number) => {
      const steps = Math.max(1, Math.ceil(Math.abs(b - a) / 8));
      for (let k = 0; k <= steps; k++) path.push(this.sampleRoad(road, a + (b - a) * k / steps));
    };
    if (start.road === end.road && Math.abs(start.along - end.along) <= Math.min(viaA, viaB)) {
      appendRange(start.road, start.along, end.along); return path;
    }
    let node = viaA < viaB ? end.road.a : end.road.b;
    if (!Number.isFinite(Math.min(viaA, viaB))) return [];
    const lastNode = node, chain: { from: number; to: number; road: RoadEdge }[] = [];
    while (prev.has(node)) { const p = prev.get(node)!; chain.unshift({ from: p.node, to: node, road: p.road }); node = p.node; }
    appendRange(start.road, start.along, node === start.road.a ? 0 : start.road.length);
    for (const step of chain) appendRange(step.road, step.from === step.road.a ? 0 : step.road.length, step.to === step.road.b ? step.road.length : 0);
    appendRange(end.road, lastNode === end.road.a ? 0 : end.road.length, end.along);
    return path;
  }
}
let cachedPlan: WorldPlan | undefined;
export function worldPlan(seed: number) { if (!cachedPlan || cachedPlan.seed !== seed) cachedPlan = new WorldPlan(seed); return cachedPlan; }
export function districtAt(seed: number, cx: number, cz: number) { return worldPlan(seed).district((cx + 0.5) * BLOCK, (cz + 0.5) * BLOCK); }
export function generateBlock(seed: number, cx: number, cz: number) {
  const plan = worldPlan(seed), r = randomFor(seed, cx, cz), buildings: Building[] = [];
  const trees: (Point & { y: number; height: number })[] = [];
  const district = districtAt(seed, cx, cz);
  const coins: (Point & { id: string; y: number })[] = [];
  for (let i = 0; i < 22; i++) {
    const x = 9 + r() * 54, z = 9 + r() * 54, wx = cx * BLOCK + x, wz = cz * BLOCK + z;
    const n = plan.nearestRoad(wx, wz), kind = plan.district(wx, wz);
    if (plan.isWater(wx, wz) || plan.landmarks.some(l => distance(l, { x: wx, z: wz }) < (l.kind === "crane" ? 46 : 18))) continue;
    if ((kind === "hills" || kind === "park" || n.distance > 60) && n.distance > n.road.width / 2 + 4) {
      trees.push({ x, z, y: plan.heightAt(wx, wz), height: 5 + r() * 8 }); continue;
    }
    if (kind === "coast" || n.distance > 62 || n.distance < n.road.width / 2 + 13) continue;
    const style = kind === "industrial" ? "warehouse" : kind === "apartments" ? "apartment" : kind === "commercial" || kind === "oldtown" ? "shop" : "house";
    const w = style === "warehouse" ? 24 : 10 + r() * 7, d = style === "warehouse" ? 18 : 10 + r() * 7;
    const radius = Math.hypot(w, d) / 2 + 2;
    if (n.distance < n.road.width / 2 + radius + 3 || buildings.some(b => Math.hypot(x - b.x, z - b.z) < radius + Math.hypot(b.w, b.d) / 2 + 3)) continue;
    if (x - radius < 0 || x + radius > BLOCK || z - radius < 0 || z + radius > BLOCK) continue;
    if (plan.landmarks.some(l => distance(l, { x: wx, z: wz }) < (l.kind === "crane" ? 58 : 26))) continue;
    buildings.push({ x, z, w, d, y: plan.heightAt(wx, wz), yaw: n.yaw + Math.PI / 2,
      h: style === "apartment" ? 15 + Math.floor(r() * 7) * 3 : style === "warehouse" ? 8 : style === "shop" ? 5 + r() * 4 : 4 + r() * 3,
      style, color: Math.floor(r() * 6), shop: style === "shop" });
  }
  for (const s of plan.segments) {
    const p = plan.sampleRoad(s.road, s.start + s.length / 2, 2.8);
    if (chunkAt(p.x, p.z).x === cx && chunkAt(p.x, p.z).z === cz) coins.push({ id: `${s.road.id}:${s.start.toFixed(3)}`, x: p.x - cx * BLOCK, z: p.z - cz * BLOCK, y: p.y + 1 });
  }
  return { cx, cz, district, buildings, trees, park: district === "park", sign: Math.floor(r() * 6), coins };
}
export function chunkAt(x: number, z: number) { return { x: Math.floor(x / BLOCK), z: Math.floor(z / BLOCK) }; }
export function collectedKey(seed: string) { return `copperline:${seed}`; }
export function segmentDistanceSquared(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2;
}
