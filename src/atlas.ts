import { SHOP } from "./inventory";
import { BLOCK, DISTRICT_NAMES, generateBlock, type Point, type WorldPlan } from "./generation";
export type MapState = { plan: WorldPlan; player: Point; yaw: number; vehicles: (Point & { active: boolean })[] };
const COLORS = { residential: "#9ba57b", commercial: "#bcaa87", apartments: "#aaa48d", industrial: "#9eaaa4", park: "#7c9c76", oldtown: "#b6a07c", hills: "#718567", coast: "#c6b588" };
export class Atlas {
  center: Point = { x: 0, z: 0 };
  scale = 0.5;
  waypoint: Point | null = null;
  route: Point[] = [];
  explored = new Set<string>();
  background = document.createElement("canvas");
  backgroundSeed = -1;
  routeTime = 0;
  canvas = document.getElementById("world-map") as HTMLCanvasElement;
  panel = document.getElementById("atlas")!;
  down: { x: number; y: number; center: Point; moved: boolean } | null = null;
  constructor(public state: () => MapState, close: () => void) {
    document.getElementById("map-close")!.addEventListener("click", close);
    document.getElementById("map-center")!.addEventListener("click", () => { this.center = { ...this.state().player }; this.drawLarge(); });
    document.getElementById("map-clear")!.addEventListener("click", () => { this.waypoint = null; this.route = []; this.drawLarge(); });
    this.canvas.addEventListener("wheel", e => {
      e.preventDefault(); const p = this.screenPoint(e.clientX, e.clientY); this.scale = Math.max(0.12, Math.min(4, this.scale * Math.exp(-e.deltaY * 0.0015)));
      const next = this.screenPoint(e.clientX, e.clientY); this.center.x += p.x - next.x; this.center.z += p.z - next.z; this.drawLarge();
    }, { passive: false });
    this.canvas.addEventListener("pointerdown", e => { if (e.button !== 0) return; this.canvas.setPointerCapture(e.pointerId); this.down = { x: e.clientX, y: e.clientY, center: { ...this.center }, moved: false }; });
    this.canvas.addEventListener("pointermove", e => {
      if (!this.down) return; const dx = e.clientX - this.down.x, dy = e.clientY - this.down.y;
      this.down.moved ||= Math.hypot(dx, dy) > 5; this.center = { x: this.down.center.x - dx / this.scale, z: this.down.center.z - dy / this.scale }; this.drawLarge();
    });
    this.canvas.addEventListener("pointerup", e => {
      if (!this.down) return;
      if (!this.down.moved) { const p = this.screenPoint(e.clientX, e.clientY), n = this.state().plan.nearestRoad(p.x, p.z); this.waypoint = { x: n.x, z: n.z }; this.updateRoute(); }
      this.down = null; this.drawLarge();
    });
    this.canvas.addEventListener("pointercancel", () => this.down = null);
    window.addEventListener("resize", () => { if (!this.panel.hidden) this.drawLarge(); });
  }
  reset() { this.waypoint = null; this.route = []; this.explored.clear(); this.backgroundSeed = -1; }
  open() { this.panel.hidden = false; this.center = { x: 0, z: -40 }; const rect = this.canvas.getBoundingClientRect(); this.scale = Math.min(rect.width / 1750, rect.height / 1400); this.drawLarge(); }
  close() { this.panel.hidden = true; this.down = null; }
  screenPoint(x: number, y: number) { const rect = this.canvas.getBoundingClientRect(); return { x: this.center.x + (x - rect.left - rect.width / 2) / this.scale, z: this.center.z + (y - rect.top - rect.height / 2) / this.scale }; }
  updateRoute() { this.route = this.waypoint ? this.state().plan.route(this.state().player, this.waypoint) : []; }
  tick(dt: number) {
    const s = this.state(); this.explored.add(`${Math.floor(s.player.x / BLOCK)},${Math.floor(s.player.z / BLOCK)}`);
    this.routeTime += dt;
    if (this.waypoint && this.routeTime > 1) { this.routeTime = 0; this.updateRoute(); if (Math.hypot(s.player.x - this.waypoint.x, s.player.z - this.waypoint.z) < 12) { this.waypoint = null; this.route = []; } }
  }
  prepare() {
    const plan = this.state().plan; if (this.backgroundSeed === plan.seed) return;
    this.background.width = 900; this.background.height = 800;
    const c = this.background.getContext("2d")!;
    for (let z = 0; z < 800; z += 3) for (let x = 0; x < 900; x += 3) {
      const wx = x * 2 - 900, wz = z * 2 - 800;
      c.fillStyle = plan.isWater(wx, wz) ? "#557f83" : COLORS[plan.district(wx, wz)]; c.fillRect(x, z, 3, 3);
      const h = plan.naturalHeight(wx, wz); if (h > 7) { c.fillStyle = `rgba(39,61,36,${Math.min(0.28, h / 140)})`; c.fillRect(x, z, 3, 3); }
    }
    this.backgroundSeed = plan.seed;
  }
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, center: Point, scale: number, large: boolean) {
    this.prepare(); const state = this.state(), plan = state.plan;
    ctx.fillStyle = "#668879"; ctx.fillRect(0, 0, width, height);
    const xy = (p: Point) => ({ x: (p.x - center.x) * scale + width / 2, y: (p.z - center.z) * scale + height / 2 });
    const top = xy({ x: -900, z: -800 }); ctx.drawImage(this.background, top.x, top.y, 1800 * scale, 1600 * scale);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const line = (points: Point[], color: string, lineWidth: number) => { if (!points.length) return; ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); points.forEach((p, i) => { const q = xy(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke(); };
    for (const road of plan.roads) line(road.points, road.bridge ? "#f6db9e" : "#d9ccb0", Math.max(2, (road.width + 4) * scale));
    for (const road of plan.roads) line(road.points, "#6b6a59", Math.max(1, road.width * scale));
    if (scale > 0.7) {
      const x0 = Math.floor((center.x - width / scale / 2) / BLOCK), x1 = Math.floor((center.x + width / scale / 2) / BLOCK);
      const z0 = Math.floor((center.z - height / scale / 2) / BLOCK), z1 = Math.floor((center.z + height / scale / 2) / BLOCK);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const b of this.block(plan.seed, x, z).buildings) {
        const q = xy({ x: x * BLOCK + b.x, z: z * BLOCK + b.z }); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-b.yaw); ctx.fillStyle = "#686b59"; ctx.fillRect(-b.w / 2 * scale, -b.d / 2 * scale, b.w * scale, b.d * scale); ctx.restore();
      }
    }
    line(this.route, "#2c554d", large ? 7 : 5); line(this.route, "#f4c468", large ? 4 : 3);
    if (large) {
      for (const label of [{ x: -450, z: -480, text: "山地观景区" }, { x: -470, z: 210, text: "铜线老城" }, { x: -40, z: -190, text: "日落中心" }, { x: 510, z: 230, text: "港湾仓储" }, { x: -200, z: 525, text: "海 滨 大 道" }]) {
        const q = xy(label); ctx.font = "600 13px sans-serif"; ctx.fillStyle = "#f8efd6"; ctx.textAlign = "center"; ctx.fillText(label.text, q.x, q.y);
      }
      for (const l of plan.landmarks) {
        const q = xy(l), visited = this.explored.has(`${Math.floor(l.x / BLOCK)},${Math.floor(l.z / BLOCK)}`);
        ctx.fillStyle = visited ? "#ffe1a0" : "#d1c5ab"; ctx.fillRect(q.x - 4, q.y - 4, 8, 8); ctx.font = "11px sans-serif"; ctx.fillText(visited ? l.name : "未探索地标", q.x, q.y + 18);
      }
    }
    const shop = xy(SHOP); ctx.fillStyle = "#ffd076"; ctx.fillRect(shop.x - 5, shop.y - 5, 10, 10);
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.fillText("武器商店", shop.x + 9, shop.y + 4);
    for (const car of state.vehicles) { const q = xy(car); ctx.fillStyle = car.active ? "#ffb25e" : "#e1d8bd"; ctx.fillRect(q.x - 3, q.y - 4, 6, 8); }
    if (this.waypoint) { const q = xy(this.waypoint); ctx.strokeStyle = "#ffe5aa"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.stroke(); }
    const p = xy(state.player); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-state.yaw); ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fillStyle = "#fff4d5"; ctx.strokeStyle = "#29483d"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  blocks = new Map<string, ReturnType<typeof generateBlock>>();
  block(seed: number, x: number, z: number) {
    const key = `${seed}:${x},${z}`;
    if (!this.blocks.has(key)) { if (this.blocks.size > 700) this.blocks.delete(this.blocks.keys().next().value!); this.blocks.set(key, generateBlock(seed, x, z)); }
    return this.blocks.get(key)!;
  }
  drawLarge() {
    const rect = this.canvas.getBoundingClientRect(); this.canvas.width = Math.max(1, Math.round(rect.width)); this.canvas.height = Math.max(1, Math.round(rect.height));
    this.draw(this.canvas.getContext("2d")!, this.canvas.width, this.canvas.height, this.center, this.scale, true);
    const s = this.state(); document.getElementById("map-location")!.textContent = DISTRICT_NAMES[s.plan.district(s.player.x, s.player.z)];
    const length = this.route.reduce((n, p, i, a) => n + (i ? Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) : 0), 0);
    document.getElementById("map-route")!.textContent = this.waypoint ? `沿道路导航 · ${(length / 1000).toFixed(2)} km` : "点击道路设置目的地";
  }
}
