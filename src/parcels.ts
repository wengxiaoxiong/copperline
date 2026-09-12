import { VENUES, venueFor } from "./venues";
import type { Building, Entrance, Point, WorldPlan } from "./generation";

export const SIDEWALK = 4;
export type Plot = Point & { w: number; d: number; yaw: number };
export type Parcel = Plot & {
  id: string; road: number; along: number; side: number; y: number;
  use: "housing" | "shops" | "apartments" | "yard" | "parking" | "garden" | "court" | "market" | "depot";
  infill?: boolean;
  building?: Building;
};

// Coordinates within a plot: negative z is the street-facing edge.
export function plotPoint(plot: Plot, x: number, z: number): Point {
  const c = Math.cos(plot.yaw), s = Math.sin(plot.yaw);
  return { x: plot.x + x * c + z * s, z: plot.z - x * s + z * c };
}
export function insidePlot(plot: Plot, point: Point, margin = 0) {
  const dx = point.x - plot.x, dz = point.z - plot.z, c = Math.cos(plot.yaw), s = Math.sin(plot.yaw);
  return Math.abs(dx * c - dz * s) <= plot.w / 2 + margin && Math.abs(dx * s + dz * c) <= plot.d / 2 + margin;
}
export function plotsOverlap(a: Plot, b: Plot, gap = 0) {
  const axes = (p: Plot) => [{ x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }];
  const aa = axes(a), bb = axes(b), dot = (u: Point, v: Point) => u.x * v.x + u.z * v.z;
  for (const axis of [...aa, ...bb]) {
    const ra = Math.abs(dot(aa[0], axis)) * a.w / 2 + Math.abs(dot(aa[1], axis)) * a.d / 2;
    const rb = Math.abs(dot(bb[0], axis)) * b.w / 2 + Math.abs(dot(bb[1], axis)) * b.d / 2;
    if (Math.abs((b.x - a.x) * axis.x + (b.z - a.z) * axis.z) >= ra + rb + gap) return false;
  }
  return true;
}

// Plan street frontage globally; streaming cells only own the resulting objects.
// The current road graph is not a planar subdivision, so these are frontage
// parcels, not claimed closed city-block polygons.
export function planParcels(plan: WorldPlan, randomFor: (seed: number, x: number, z: number) => () => number): Parcel[] {
  const parcels: Parcel[] = [], buckets = new Map<string, Parcel[]>();
  const keys = (p: Plot) => {
    const r = Math.hypot(p.w, p.d) / 2 + 1, result: string[] = [];
    for (let x = Math.floor((p.x - r) / 64); x <= Math.floor((p.x + r) / 64); x++)
      for (let z = Math.floor((p.z - r) / 64); z <= Math.floor((p.z + r) / 64); z++) result.push(`${x},${z}`);
    return result;
  };
  const corridors = plan.segments.map(s => ({
    x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2,
    w: s.length, d: s.road.width + SIDEWALK * 2 - 0.4,
    yaw: Math.atan2(-(s.b.z - s.a.z), s.b.x - s.a.x),
  }));
  for (const road of plan.roads) for (const side of [-1, 1]) {
    const rng = randomFor(plan.seed ^ 0x706c6f74, road.id, side);
    let cursor = 23, index = 0;
    while (cursor < road.length - 23) {
      const districtPoint = plan.sampleRoad(road, cursor, side * 28);
      const district = plan.district(districtPoint.x, districtPoint.z);
      const dense = district === "commercial" || district === "oldtown" || district === "apartments";
      const industrial = district === "industrial";
      const step = industrial ? 42 : dense ? 23 : 29;
      const along = cursor + step / 2;
      cursor += step; index++;
      if (cursor > road.length - 23 || district === "hills" || district === "park") continue;
      const d = industrial ? 44 : dense ? 32 : 35;
      const p = plan.sampleRoad(road, along, side * (road.width / 2 + SIDEWALK + d / 2 + 0.6));
      const use = industrial ? "yard" : district === "apartments" ? "apartments" : dense || district === "coast" ? "shops" : "housing";
      const parcel: Parcel = {
        id: `${road.id}:${side}:${index}`, road: road.id, side, along,
        x: p.x, z: p.z, y: p.y + 0.02, w: step - 1.4, d, yaw: p.yaw + side * Math.PI / 2,
        use: index % 7 === 4 && dense ? "parking" : use,
      };
      const samples = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => plotPoint(parcel, x * parcel.w / 2, z * d / 2)));
      // Only terrace gentle land; the slab reaches below the sampled terrain.
      if (samples.some(q => {
        const ground = plan.heightAt(q.x, q.z);
        return plan.isWater(q.x, q.z) || ground > parcel.y - 0.02 || parcel.y - ground > 0.45;
      })) continue;
      const radius = Math.hypot(parcel.w, parcel.d) / 2;
      if (corridors.some(c => {
        const reach = radius + Math.hypot(c.w, c.d) / 2;
        return Math.abs(c.x - p.x) < reach && Math.abs(c.z - p.z) < reach && plotsOverlap(parcel, c);
      })) continue;
      if (plan.landmarks.some(l => insidePlot(parcel, l, l.kind === "crane" ? 46 : 20))) continue;
      // Reserve the existing home car, helicopter and weapon shop together.
      if (insidePlot(parcel, { x: 8, z: 22 }, 14)) continue;
      const cells = keys(parcel), neighbors = new Set(cells.flatMap(k => buckets.get(k) ?? []));
      if ([...neighbors].some(other => plotsOverlap(parcel, other, 0.35))) continue;
      if (parcel.use !== "parking") {
        const style = use === "yard" ? "warehouse" : use === "apartments" ? "apartment" : use === "shops" ? "shop" : "house";
        const w = style === "warehouse" ? 29 : style === "house" ? 16 + rng() * 2 : parcel.w - 3.2;
        const depth = style === "warehouse" ? 22 : style === "house" ? 15 : 20;
        const setback = style === "warehouse" ? 13 : style === "house" ? 8 : 4;
        const center = plotPoint(parcel, style === "house" ? -2.1 : 0, -d / 2 + setback + depth / 2);
        const entrance: Entrance | undefined = style === "warehouse" ? undefined : {
          x: style === "house" ? 0 : (rng() - 0.5) * (w - 4),
          z: -depth / 2,
          w: style === "house" ? 1.6 : 2.2 + rng() * 0.6,
          h: 2.2 + rng() * 0.4,
        };
        parcel.building = {
          ...center, y: parcel.y, w, d: depth, yaw: parcel.yaw,
          h: style === "apartment" ? 15 + Math.floor(rng() * 5) * 3 : style === "shop" ? 7 + Math.floor(rng() * 2) * 3 : style === "warehouse" ? 8 : 4.5 + Math.floor(rng() * 2) * 2.8,
          color: Math.floor(rng() * 6), shop: style === "shop", style,
          entrance,
        };
        if (style === "shop") {
          const venue = venueFor(plan.seed, road.id, index * side);
          Object.assign(parcel.building, { venue, h: VENUES[venue].height, color: VENUES[venue].wall });
        }
      }
      parcels.push(parcel);
      for (const key of cells) { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key)!.push(parcel); }
    }
  }
  // Fill the spaces behind frontage with smaller, district-specific plots.
  // Large plots go first; smaller gardens use the remaining pockets. All use
  // the same road/landmark reservations and spatial index as street frontage.
  const minX = Math.min(...plan.nodes.map(n => n.x)), maxX = Math.max(...plan.nodes.map(n => n.x));
  const minZ = Math.min(...plan.nodes.map(n => n.z)), maxZ = Math.max(...plan.nodes.map(n => n.z));
  for (const size of [44, 26, 14]) {
    const step = size === 44 ? 24 : size === 26 ? 16 : 10;
    for (let gx = Math.ceil(minX / step); gx * step < maxX; gx++) for (let gz = Math.ceil(minZ / step); gz * step < maxZ; gz++) {
      const x = gx * step, z = gz * step, district = plan.district(x, z);
      if (district === "hills" || plan.isWater(x, z)) continue;
      const near = plan.nearestRoad(x, z);
      if (near.distance > 165 || near.distance < near.road.width / 2 + SIDEWALK + size / 2) continue;
      const rng = randomFor(plan.seed ^ (0x696e6669 + size), gx, gz);
      const side = ((x - near.x) * Math.cos(near.yaw) - (z - near.z) * Math.sin(near.yaw)) > 0 ? 1 : -1;
      const yaw = near.yaw + side * Math.PI / 2;
      const use: Parcel["use"] = district === "park" || size === 14 ? "garden" : district === "industrial" ? "depot"
        : size === 44 ? (rng() < 0.58 ? "apartments" : "court")
        : district === "commercial" || district === "oldtown" || district === "coast" ? "market" : rng() < 0.55 ? "apartments" : "garden";
      const parcel: Parcel = { id: `infill:${size}:${gx}:${gz}`, x, z, y: 0, w: size, d: size,
        yaw, road: near.road.id, along: near.along, side, use, infill: true };
      const radius = Math.hypot(size, size) / 2;
      if (corridors.some(c => Math.abs(c.x-x) < radius + Math.hypot(c.w,c.d)/2 && Math.abs(c.z-z) < radius + Math.hypot(c.w,c.d)/2 && plotsOverlap(parcel,c,1))) continue;
      if (plan.landmarks.some(l => insidePlot(parcel,l,l.kind === "crane" ? 46 : 20)) || insidePlot(parcel,{x:8,z:22},14)) continue;
      const cells = keys(parcel), neighbors = new Set(cells.flatMap(k => buckets.get(k) ?? []));
      // A walkable gap survives even between differently rotated lots.
      if ([...neighbors].some(other => plotsOverlap(parcel,other,2.4))) continue;
      const samples = [-1,-0.5,0,0.5,1].flatMap(dx => [-1,-0.5,0,0.5,1].map(dz => plotPoint(parcel,dx*size/2,dz*size/2)));
      if (samples.some(q => plan.isWater(q.x,q.z))) continue;
      const heights = samples.map(q => plan.heightAt(q.x,q.z));
      if (Math.max(...heights)-Math.min(...heights) > 0.28) continue;
      parcel.y = Math.max(...heights) + 0.025;
      if (use === "apartments") {
        parcel.building = { x, z, y: parcel.y, yaw, w: size === 44 ? 24 : 14, d: size === 44 ? 22 : 12,
          h: (size === 44 ? 12 : 6) + Math.floor(rng()*3)*3, color: Math.floor(rng()*6), shop: false, style: "apartment",
          entrance: {x: 0, z: size === 44 ? -11 : -6, w: 2.6, h: 2.5} };
      }
      parcels.push(parcel);
      for (const key of cells) { if (!buckets.has(key)) buckets.set(key,[]); buckets.get(key)!.push(parcel); }
    }
  }
  return parcels;
}
